// Typed client for the WS play channel `/campaigns/{id}/play` (docs/02). Frame
// shapes are verified against the real uro-server handler — note that frames carry
// ONLY the fields below (no campaign_id/beat_id, no scene/mode frames that docs/08
// advertises but app.py does not emit).

import type { Connection } from './client'

// ---- Client → server -----------------------------------------------------------

export interface IntentFrame {
  type: 'intent'
  text: string
}
export interface TableTalkClientFrame {
  type: 'table_talk'
  text: string
}
export interface VoteFrame {
  type: 'vote'
  choice: string
}
export type PlayClientFrame = IntentFrame | TableTalkClientFrame | VoteFrame

// ---- Server → client -----------------------------------------------------------

export interface ParticipantJoined {
  type: 'participant_joined'
  participant_id: string
}
export interface ParticipantLeft {
  type: 'participant_left'
  participant_id: string
}
export interface BeatStarted {
  type: 'beat_started'
  participant_id: string
  intent: string
}
export interface NarrationChunk {
  type: 'narration_chunk'
  participant_id: string
  text: string
}
export interface BeatCommitted {
  type: 'beat_committed'
  participant_id: string
  intent: string
  narration: string
}
export interface BeatFailed {
  type: 'beat_failed'
  participant_id: string
  intent: string
  error: string
}
export interface NotYourTurn {
  type: 'not_your_turn'
  participant_id: string
  text: string
}
export interface ProposalOpened {
  type: 'proposal_opened'
  participant_id: string
  text: string
}
export interface IntentRejected {
  type: 'intent_rejected'
  participant_id: string
  text: string
}
export interface TableTalkFrame {
  type: 'table_talk'
  participant_id: string
  text: string
}
export interface VoteTally {
  type: 'vote_tally'
  participant_id: string
  choice: string
  tally: unknown
}
export interface VoteDecided {
  type: 'vote_decided'
  choice: string
}
export interface VoteUnsupported {
  type: 'vote_unsupported'
  participant_id: string
}
export interface OutcomeRecorded {
  type: 'outcome_recorded'
  encounter_id: string
  commit_id?: string
  committed_events?: unknown
  receipt?: unknown
}

export type PlayServerFrame =
  | ParticipantJoined
  | ParticipantLeft
  | BeatStarted
  | NarrationChunk
  | BeatCommitted
  | BeatFailed
  | NotYourTurn
  | ProposalOpened
  | IntentRejected
  | TableTalkFrame
  | VoteTally
  | VoteDecided
  | VoteUnsupported
  | OutcomeRecorded

const SERVER_FRAME_TYPES = new Set<string>([
  'participant_joined',
  'participant_left',
  'beat_started',
  'narration_chunk',
  'beat_committed',
  'beat_failed',
  'not_your_turn',
  'proposal_opened',
  'intent_rejected',
  'table_talk',
  'vote_tally',
  'vote_decided',
  'vote_unsupported',
  'outcome_recorded',
])

/** Build the ws:// (or wss://) play URL, carrying the bearer token as ?token=. */
export function playSocketUrl(conn: Connection, campaignId: string): string {
  const base = conn.baseUrl.replace(/\/+$/, '')
  const wsBase = base.replace(/^http/i, 'ws') // http→ws, https→wss
  const token = conn.token ?? ''
  return `${wsBase}/campaigns/${encodeURIComponent(campaignId)}/play?token=${encodeURIComponent(token)}`
}

/** Parse an incoming text frame into a known server frame, or null if unrecognized. */
export function parseServerFrame(data: string): PlayServerFrame | null {
  try {
    const obj: unknown = JSON.parse(data)
    if (
      obj &&
      typeof obj === 'object' &&
      'type' in obj &&
      typeof (obj as { type: unknown }).type === 'string' &&
      SERVER_FRAME_TYPES.has((obj as { type: string }).type)
    ) {
      return obj as PlayServerFrame
    }
  } catch {
    // not JSON — ignore
  }
  return null
}

export interface PlaySocketHandlers {
  onOpen?: () => void
  onFrame?: (frame: PlayServerFrame) => void
  onClose?: (code: number, reason: string) => void
  onError?: () => void
}

export interface PlaySocketController {
  send: (frame: PlayClientFrame) => void
  close: () => void
}

/** Open a live play socket. Thin wrapper over the browser WebSocket. */
export function openPlaySocket(
  conn: Connection,
  campaignId: string,
  handlers: PlaySocketHandlers,
): PlaySocketController {
  const ws = new WebSocket(playSocketUrl(conn, campaignId))
  ws.onopen = () => handlers.onOpen?.()
  ws.onmessage = (ev) => {
    const frame = parseServerFrame(String(ev.data))
    if (frame) handlers.onFrame?.(frame)
  }
  ws.onclose = (ev) => handlers.onClose?.(ev.code, ev.reason)
  ws.onerror = () => handlers.onError?.()

  return {
    send: (frame) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame))
    },
    close: () => ws.close(),
  }
}
