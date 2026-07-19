import { describe, expect, it } from 'vitest'
import { buildOutcomeBundle, parseCsv } from './outcome'

describe('parseCsv', () => {
  it('trims and drops empties', () => {
    expect(parseCsv(' a, b ,,c ')).toEqual(['a', 'b', 'c'])
    expect(parseCsv('')).toEqual([])
  })
})

const EMPTY = {
  participants: '',
  witnesses: '',
  casualties: '',
  featActor: '',
  featDescription: '',
  durationRounds: '',
}

describe('buildOutcomeBundle', () => {
  it('omits empty fields entirely (extra=forbid friendliness)', () => {
    expect(buildOutcomeBundle(EMPTY)).toEqual({})
  })

  it('includes set fields and a single feat', () => {
    expect(
      buildOutcomeBundle({
        participants: 'a,b',
        witnesses: 'a',
        casualties: 'b',
        featActor: 'a',
        featDescription: 'split the champion in two',
        durationRounds: '3',
      }),
    ).toEqual({
      participants: ['a', 'b'],
      witnesses: ['a'],
      casualties: ['b'],
      feats: [{ actor: 'a', description: 'split the champion in two' }],
      duration_rounds: 3,
    })
  })

  it('never includes encounter_id (that is a path param)', () => {
    expect('encounter_id' in buildOutcomeBundle({ ...EMPTY, participants: 'a' })).toBe(false)
  })

  it('ignores a non-positive duration', () => {
    expect(buildOutcomeBundle({ ...EMPTY, durationRounds: '0' }).duration_rounds).toBeUndefined()
  })
})
