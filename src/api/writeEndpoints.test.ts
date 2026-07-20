import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Connection } from './client'
import {
  addCodexNote,
  backfillPack,
  createCampaign,
  createMarker,
  createWorld,
  dryRun,
  endCampaign,
  forkBranch,
  importWorld,
  probePack,
  reportOutcome,
  timeSkip,
  validatePack,
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

describe('M4 slice 4: dry-run', () => {
  it('dryRun POSTs { intent } to /campaigns/{c}/dry-run', async () => {
    const calls = capture()
    await dryRun(conn, 'cmp_1', { intent: 'I kick the door' })
    expect(calls[0].url).toBe('http://s.test/campaigns/cmp_1/dry-run')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ intent: 'I kick the door' })
  })
})

describe('M5 pack authoring (multipart upload)', () => {
  it('validatePack POSTs FormData to /worlds/validate (no JSON Content-Type)', async () => {
    const calls = capture()
    const file = new File(['x'], 'pack.zip', { type: 'application/zip' })
    await validatePack(conn, file)
    expect(calls[0].url).toBe('http://s.test/worlds/validate')
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.body).toBeInstanceOf(FormData)
    const headers = calls[0].init.headers as unknown as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined() // the browser sets the multipart boundary
    expect(headers['Authorization']).toBe('Bearer tok')
  })

  it('backfillPack targets /worlds/backfill', async () => {
    const calls = capture()
    await backfillPack(conn, new File(['x'], 'p.zip'))
    expect(calls[0].url).toBe('http://s.test/worlds/backfill')
  })

  it('probePack passes ?tries=', async () => {
    const calls = capture()
    await probePack(conn, new File(['x'], 'p.zip'), 5)
    expect(calls[0].url).toBe('http://s.test/worlds/probe?tries=5')
  })
})

describe('M5 slice 2: import', () => {
  it('importWorld POSTs the bundle JSON to /worlds/import', async () => {
    const calls = capture()
    await importWorld(conn, { world_name: 'Ashfall', manifest_hash: 'h_x' })
    expect(calls[0].url).toBe('http://s.test/worlds/import')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      world_name: 'Ashfall',
      manifest_hash: 'h_x',
    })
    const headers = calls[0].init.headers as unknown as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })
})

describe('M5 slice 3: end + codex writes', () => {
  it('endCampaign POSTs { marker, outcome } to /campaigns/{c}/end', async () => {
    const calls = capture()
    await endCampaign(conn, 'cmp_1', { marker: 'the-end', outcome: 'ash' })
    expect(calls[0].url).toBe('http://s.test/campaigns/cmp_1/end')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ marker: 'the-end', outcome: 'ash' })
  })
  it('addCodexNote POSTs the note to /campaigns/{c}/codex', async () => {
    const calls = capture()
    await addCodexNote(conn, 'cmp_1', {
      text: 'remember the code',
      pinned: true,
      refs: ['name:vault'],
    })
    expect(calls[0].url).toBe('http://s.test/campaigns/cmp_1/codex')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      text: 'remember the code',
      pinned: true,
      refs: ['name:vault'],
    })
  })
})
