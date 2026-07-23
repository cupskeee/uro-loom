import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useConnection } from '../config/connection'
import { openPlaySocket, type PlayClientFrame, type PlaySocketController } from '../api/playSocket'
import { useChronicle } from '../api/queries'
import { initialPlayState, playReducer } from './playSession'

// How much persisted history to seed the transcript with on load (the WS only streams from NOW).
const HYDRATE_LIMIT = 100

/**
 * Manage a live play socket for a campaign: open on mount, fold frames into
 * session state via the pure reducer, and expose `send`. Reconnects when the
 * connection or campaign changes.
 */
export function usePlaySession(campaignId: string) {
  const { connection } = useConnection()
  const [state, dispatch] = useReducer(playReducer, initialPlayState)
  const ctrlRef = useRef<PlaySocketController | null>(null)
  const chronicle = useChronicle(campaignId, HYDRATE_LIMIT)

  useEffect(() => {
    if (!connection) return
    dispatch({ type: '_reset' })
    const ctrl = openPlaySocket(connection, campaignId, {
      onOpen: () => dispatch({ type: '_open' }),
      onFrame: (frame) => dispatch({ type: 'frame', frame }),
      onClose: (code, reason) => dispatch({ type: '_closed', code, reason }),
      onError: () => dispatch({ type: '_error' }),
    })
    ctrlRef.current = ctrl
    return () => {
      ctrl.close()
      ctrlRef.current = null
    }
  }, [connection, campaignId])

  // Seed the transcript from persisted beats once, so a refresh/reconnect doesn't start blank.
  // `_reset` (above, on campaign change) clears `hydrated`; the chronicle query is keyed by
  // campaign, so its data becomes the NEW campaign's history before this re-runs.
  useEffect(() => {
    if (state.hydrated || !chronicle.data) return
    dispatch({
      type: '_hydrate',
      beats: chronicle.data.beats.map((b) => ({
        participant: b.participant_id,
        intent: b.intent_text,
        narration: b.narration,
      })),
    })
  }, [state.hydrated, chronicle.data])

  const send = useCallback((frame: PlayClientFrame) => {
    ctrlRef.current?.send(frame)
  }, [])

  return { state, send }
}
