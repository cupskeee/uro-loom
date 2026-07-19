import { useCallback, useEffect, useReducer, useRef } from 'react'
import { useConnection } from '../config/connection'
import { openPlaySocket, type PlayClientFrame, type PlaySocketController } from '../api/playSocket'
import { initialPlayState, playReducer } from './playSession'

/**
 * Manage a live play socket for a campaign: open on mount, fold frames into
 * session state via the pure reducer, and expose `send`. Reconnects when the
 * connection or campaign changes.
 */
export function usePlaySession(campaignId: string) {
  const { connection } = useConnection()
  const [state, dispatch] = useReducer(playReducer, initialPlayState)
  const ctrlRef = useRef<PlaySocketController | null>(null)

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

  const send = useCallback((frame: PlayClientFrame) => {
    ctrlRef.current?.send(frame)
  }, [])

  return { state, send }
}
