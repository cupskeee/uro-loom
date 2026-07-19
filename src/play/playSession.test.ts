import { describe, expect, it } from 'vitest'
import type { PlayServerFrame } from '../api/playSocket'
import { type PlayState, initialPlayState, playReducer } from './playSession'

function fold(frames: PlayServerFrame[], start: PlayState = initialPlayState): PlayState {
  return frames.reduce((s, frame) => playReducer(s, { type: 'frame', frame }), start)
}

describe('playReducer', () => {
  it('streams a beat: started → chunks → committed into one committed beat', () => {
    const s = fold([
      { type: 'beat_started', participant_id: 'p1', intent: 'look' },
      { type: 'narration_chunk', participant_id: 'p1', text: 'Hello ' },
      { type: 'narration_chunk', participant_id: 'p1', text: 'world' },
      { type: 'beat_committed', participant_id: 'p1', intent: 'look', narration: 'Hello world' },
    ])
    const beats = s.entries.filter((e) => e.kind === 'beat')
    expect(beats).toHaveLength(1)
    expect(beats[0]).toMatchObject({
      intent: 'look',
      narration: 'Hello world',
      status: 'committed',
    })
  })

  it('accumulates narration chunks while streaming', () => {
    const s = fold([
      { type: 'beat_started', participant_id: 'p1', intent: 'x' },
      { type: 'narration_chunk', participant_id: 'p1', text: 'ab' },
      { type: 'narration_chunk', participant_id: 'p1', text: 'cd' },
    ])
    expect(s.entries[0]).toMatchObject({ narration: 'abcd', status: 'streaming' })
  })

  it('marks a beat failed', () => {
    const s = fold([
      { type: 'beat_started', participant_id: 'p1', intent: 'x' },
      { type: 'beat_failed', participant_id: 'p1', intent: 'x', error: 'ruleset mismatch' },
    ])
    expect(s.entries.find((e) => e.kind === 'beat')).toMatchObject({
      status: 'failed',
      error: 'ruleset mismatch',
    })
  })

  it('records table_talk as a talk entry, never a beat (non-canon)', () => {
    const s = fold([{ type: 'table_talk', participant_id: 'p2', text: 'psst' }])
    expect(s.entries).toHaveLength(1)
    expect(s.entries[0]).toMatchObject({ kind: 'talk', text: 'psst', participant: 'p2' })
  })

  it('tracks roster join/leave and de-dupes joins', () => {
    const s = fold([
      { type: 'participant_joined', participant_id: 'a' },
      { type: 'participant_joined', participant_id: 'b' },
      { type: 'participant_joined', participant_id: 'a' },
      { type: 'participant_left', participant_id: 'a' },
    ])
    expect(s.roster).toEqual(['b'])
  })

  it('turns not_your_turn / vote_unsupported into notices', () => {
    const s = fold([
      { type: 'not_your_turn', participant_id: 'p', text: 'go' },
      { type: 'vote_unsupported', participant_id: 'p' },
    ])
    expect(s.entries.every((e) => e.kind === 'notice')).toBe(true)
  })

  it('lifecycle actions set connection status', () => {
    let s = playReducer(initialPlayState, { type: '_open' })
    expect(s.status).toBe('open')
    s = playReducer(s, { type: '_closed', code: 4401, reason: 'nope' })
    expect(s).toMatchObject({ status: 'closed', closeCode: 4401, closeReason: 'nope' })
  })

  it('_reset returns to the initial state', () => {
    const dirty = fold([{ type: 'participant_joined', participant_id: 'a' }])
    expect(playReducer(dirty, { type: '_reset' })).toEqual(initialPlayState)
  })
})
