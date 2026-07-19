// Pure reducer that folds the WS play stream into renderable session state.
// Kept free of React and the socket so it can be unit-tested directly. The
// interesting part is streaming: beat_started opens a beat, narration_chunk
// appends to it, beat_committed/beat_failed finalize it.

import type { PlayServerFrame } from '../api/playSocket'

export type ConnStatus = 'connecting' | 'open' | 'closed' | 'error'

export interface BeatEntry {
  kind: 'beat'
  id: number
  participant: string
  intent: string
  narration: string
  status: 'streaming' | 'committed' | 'failed'
  error?: string
}
export interface TalkEntry {
  kind: 'talk'
  id: number
  participant: string
  text: string
}
export interface NoticeEntry {
  kind: 'notice'
  id: number
  level: 'info' | 'warn' | 'error'
  text: string
}
export type LogEntry = BeatEntry | TalkEntry | NoticeEntry

export interface PlayState {
  status: ConnStatus
  closeCode: number | null
  closeReason: string
  roster: string[]
  entries: LogEntry[]
  nextId: number
}

export const initialPlayState: PlayState = {
  status: 'connecting',
  closeCode: null,
  closeReason: '',
  roster: [],
  entries: [],
  nextId: 1,
}

export type PlayAction =
  | { type: '_reset' }
  | { type: '_open' }
  | { type: '_closed'; code: number; reason: string }
  | { type: '_error' }
  | { type: 'frame'; frame: PlayServerFrame }

// Omit that distributes over the LogEntry union (a plain Omit<union, K> keeps only
// the keys common to every member, which would reject `participant`/`level`).
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

function push(state: PlayState, entry: DistributiveOmit<LogEntry, 'id'>): PlayState {
  const withId = { ...entry, id: state.nextId } as LogEntry
  return { ...state, entries: [...state.entries, withId], nextId: state.nextId + 1 }
}

/** Index of the most recent still-streaming beat for a participant, or -1. */
function lastStreamingBeat(entries: LogEntry[], participant: string): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (e.kind === 'beat' && e.participant === participant && e.status === 'streaming') return i
  }
  return -1
}

function updateEntry(state: PlayState, index: number, patch: Partial<BeatEntry>): PlayState {
  const entries = state.entries.slice()
  entries[index] = { ...(entries[index] as BeatEntry), ...patch }
  return { ...state, entries }
}

export function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case '_reset':
      return initialPlayState
    case '_open':
      return { ...state, status: 'open' }
    case '_closed':
      return { ...state, status: 'closed', closeCode: action.code, closeReason: action.reason }
    case '_error':
      return { ...state, status: 'error' }
    case 'frame':
      return applyFrame(state, action.frame)
  }
}

function applyFrame(state: PlayState, frame: PlayServerFrame): PlayState {
  switch (frame.type) {
    case 'participant_joined':
      return state.roster.includes(frame.participant_id)
        ? state
        : { ...state, roster: [...state.roster, frame.participant_id] }

    case 'participant_left':
      return { ...state, roster: state.roster.filter((p) => p !== frame.participant_id) }

    case 'beat_started':
      return push(state, {
        kind: 'beat',
        participant: frame.participant_id,
        intent: frame.intent,
        narration: '',
        status: 'streaming',
      })

    case 'narration_chunk': {
      const idx = lastStreamingBeat(state.entries, frame.participant_id)
      if (idx === -1) return state
      const current = state.entries[idx] as BeatEntry
      return updateEntry(state, idx, { narration: current.narration + frame.text })
    }

    case 'beat_committed': {
      const idx = lastStreamingBeat(state.entries, frame.participant_id)
      if (idx === -1) {
        // No streaming beat (e.g. we joined mid-beat) — record it as a committed beat.
        return push(state, {
          kind: 'beat',
          participant: frame.participant_id,
          intent: frame.intent,
          narration: frame.narration,
          status: 'committed',
        })
      }
      return updateEntry(state, idx, { narration: frame.narration, status: 'committed' })
    }

    case 'beat_failed': {
      const idx = lastStreamingBeat(state.entries, frame.participant_id)
      if (idx === -1) {
        return push(state, {
          kind: 'beat',
          participant: frame.participant_id,
          intent: frame.intent,
          narration: '',
          status: 'failed',
          error: frame.error,
        })
      }
      return updateEntry(state, idx, { status: 'failed', error: frame.error })
    }

    case 'table_talk':
      return push(state, { kind: 'talk', participant: frame.participant_id, text: frame.text })

    case 'not_your_turn':
      return push(state, {
        kind: 'notice',
        level: 'warn',
        text: `${frame.participant_id}: not your turn — holding "${frame.text}".`,
      })

    case 'proposal_opened':
      return push(state, {
        kind: 'notice',
        level: 'info',
        text: `${frame.participant_id} proposed: "${frame.text}" (awaiting the turn-holder).`,
      })

    case 'intent_rejected':
      return push(state, {
        kind: 'notice',
        level: 'warn',
        text: `${frame.participant_id}'s intent was rejected: "${frame.text}".`,
      })

    case 'vote_tally':
      return push(state, {
        kind: 'notice',
        level: 'info',
        text: `${frame.participant_id} voted "${frame.choice}". Tally: ${JSON.stringify(frame.tally)}.`,
      })

    case 'vote_decided':
      return push(state, {
        kind: 'notice',
        level: 'info',
        text: `Vote decided: "${frame.choice}".`,
      })

    case 'vote_unsupported':
      return push(state, {
        kind: 'notice',
        level: 'warn',
        text: 'This server does not support voting (its arbiter has no vote shape).',
      })

    case 'outcome_recorded':
      return push(state, {
        kind: 'notice',
        level: 'info',
        text: `External encounter outcome recorded (${frame.encounter_id}).`,
      })
  }
}
