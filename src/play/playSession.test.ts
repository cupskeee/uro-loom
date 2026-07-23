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

  it('_hydrate seeds committed beats from history (oldest-first), so a refresh is not blank', () => {
    const s = playReducer(initialPlayState, {
      type: '_hydrate',
      beats: [
        { participant: 'p1', intent: 'enter', narration: 'You step into the tavern.' },
        { participant: 'p1', intent: 'ask', narration: 'The barkeep nods.' },
      ],
    })
    expect(s.hydrated).toBe(true)
    expect(s.entries).toHaveLength(2)
    expect(s.entries[0]).toMatchObject({
      kind: 'beat',
      narration: 'You step into the tavern.',
      status: 'committed',
    })
    expect(s.entries.map((e) => e.id)).toEqual([1, 2])
    expect(s.nextId).toBe(3)
  })

  it('_hydrate runs once — a second call is a no-op (no duplicate history)', () => {
    const beats = [{ participant: 'p1', intent: 'x', narration: 'A.' }]
    const once = playReducer(initialPlayState, { type: '_hydrate', beats })
    const twice = playReducer(once, { type: '_hydrate', beats })
    expect(twice).toBe(once)
  })

  it('_hydrate prepends history before a beat that streamed during the fetch race, without doubling it', () => {
    // A live beat arrived before the chronicle fetch resolved.
    const live = fold([
      {
        type: 'beat_committed',
        participant_id: 'p1',
        intent: 'ask',
        narration: 'The barkeep nods.',
      },
    ])
    const s = playReducer(live, {
      type: '_hydrate',
      beats: [
        { participant: 'p1', intent: 'enter', narration: 'You step into the tavern.' },
        // same as the live one — must be de-duped, not shown twice
        { participant: 'p1', intent: 'ask', narration: 'The barkeep nods.' },
      ],
    })
    const narrations = s.entries
      .filter((e) => e.kind === 'beat')
      .map((e) => (e as { narration: string }).narration)
    expect(narrations).toEqual(['You step into the tavern.', 'The barkeep nods.'])
    expect(s.entries.map((e) => e.id)).toEqual([1, 2])
  })
})
