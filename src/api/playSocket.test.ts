import { describe, expect, it } from 'vitest'
import { parseServerFrame, playSocketUrl } from './playSocket'

describe('playSocketUrl', () => {
  it('maps http → ws', () => {
    expect(playSocketUrl({ baseUrl: 'http://127.0.0.1:8000', token: 'dev' }, 'cmp_1')).toBe(
      'ws://127.0.0.1:8000/campaigns/cmp_1/play?token=dev',
    )
  })

  it('maps https → wss, strips trailing slash, encodes id + token', () => {
    expect(playSocketUrl({ baseUrl: 'https://x.test/', token: 'a b' }, 'cmp/1')).toBe(
      'wss://x.test/campaigns/cmp%2F1/play?token=a%20b',
    )
  })

  it('sends an empty token when none is set', () => {
    expect(playSocketUrl({ baseUrl: 'http://x', token: null }, 'c')).toBe(
      'ws://x/campaigns/c/play?token=',
    )
  })
})

describe('parseServerFrame', () => {
  it('parses a known frame', () => {
    expect(
      parseServerFrame(
        '{"type":"beat_committed","participant_id":"p","intent":"i","narration":"n"}',
      ),
    ).toEqual({ type: 'beat_committed', participant_id: 'p', intent: 'i', narration: 'n' })
  })

  it('rejects an unknown frame type', () => {
    expect(parseServerFrame('{"type":"scene_update"}')).toBeNull()
  })

  it('rejects non-JSON', () => {
    expect(parseServerFrame('not json')).toBeNull()
  })

  it('rejects a payload without a string type', () => {
    expect(parseServerFrame('{"foo":1}')).toBeNull()
  })
})
