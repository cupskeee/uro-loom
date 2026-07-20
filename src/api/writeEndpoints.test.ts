import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Connection } from './client'
import {
  createCampaign,
  createMarker,
  createWorld,
  forkBranch,
  reportOutcome,
  timeSkip,
} from './endpoints'
import { ApiError, errorMessage } from './errors'

const conn: Connection = { baseUrl: 'http://s.test', token: 'tok' }

function capture() {
  const calls: { url: string; init: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return { ok: true, status: 200, text: async () => '{}' } as unknown as Response
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('write endpoints', () => {
  it('createWorld POSTs a JSON body to /worlds', async () => {
    const calls = capture()
    await createWorld(conn, { name: 'Ashfall', tone: 'grim' })
    expect(calls[0].url).toBe('http://s.test/worlds')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ name: 'Ashfall', tone: 'grim' })
    const headers = calls[0].init.headers as unknown as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toBe('Bearer tok')
  })

  it('createCampaign targets the world path', async () => {
    const calls = capture()
    await createCampaign(conn, 'wld_1', { participant: 'p1', seed: 42 })
    expect(calls[0].url).toBe('http://s.test/worlds/wld_1/campaigns')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ participant: 'p1', seed: 42 })
  })

  it('timeSkip posts days', async () => {
    const calls = capture()
    await timeSkip(conn, 'cmp_1', { days: 7 })
    expect(calls[0].url).toBe('http://s.test/campaigns/cmp_1/time-skip')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ days: 7 })
  })

  it('reportOutcome puts encounter_id in the PATH, not the body', async () => {
    const calls = capture()
    await reportOutcome(conn, 'cmp_1', 'enc-9', { participants: ['a'] })
    expect(calls[0].url).toBe('http://s.test/campaigns/cmp_1/encounters/enc-9/outcome')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ participants: ['a'] })
  })
})

describe('errorMessage', () => {
  it('prefers the server-provided detail', () => {
    expect(errorMessage(new ApiError(400, 'HTTP 400', { detail: 'missing field name' }))).toBe(
      'missing field name',
    )
  })
  it('falls back to the error message', () => {
    expect(errorMessage(new ApiError(500, 'boom'))).toBe('boom')
    expect(errorMessage(new Error('plain'))).toBe('plain')
  })
})

describe('M4 timeline writes', () => {
  it('forkBranch POSTs {from_ref, name, time_skip_days} to /worlds/{w}/branches', async () => {
    const calls = capture()
    await forkBranch(conn, 'wld_1', { from_ref: 'pre-strike', name: 'what-if', time_skip_days: 30 })
    expect(calls[0].url).toBe('http://s.test/worlds/wld_1/branches')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      from_ref: 'pre-strike',
      name: 'what-if',
      time_skip_days: 30,
    })
  })

  it('createMarker POSTs {name, branch} to /worlds/{w}/markers', async () => {
    const calls = capture()
    await createMarker(conn, 'wld_1', { name: 'pre-strike', branch: 'main' })
    expect(calls[0].url).toBe('http://s.test/worlds/wld_1/markers')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ name: 'pre-strike', branch: 'main' })
  })
})
