import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Connection } from './client'
import {
  getCampaign,
  getChronicle,
  getCommit,
  getEpistemicState,
  getEvents,
  getLog,
  getRoster,
  listBranches,
  listCampaigns,
  listWorlds,
} from './endpoints'

const conn: Connection = { baseUrl: 'http://server.test', token: 'tok' }

function captureFetch() {
  const urls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url)
      return { ok: true, status: 200, text: async () => '[]' } as unknown as Response
    }),
  )
  return urls
}

afterEach(() => vi.unstubAllGlobals())

describe('endpoint URL construction', () => {
  it('listWorlds → GET /worlds', async () => {
    const urls = captureFetch()
    await listWorlds(conn)
    expect(urls[0]).toBe('http://server.test/worlds')
  })

  it('listCampaigns with no world → /campaigns', async () => {
    const urls = captureFetch()
    await listCampaigns(conn)
    expect(urls[0]).toBe('http://server.test/campaigns')
  })

  it('listCampaigns with a world → /campaigns?world_id=', async () => {
    const urls = captureFetch()
    await listCampaigns(conn, 'wld a/b')
    expect(urls[0]).toBe('http://server.test/campaigns?world_id=wld%20a%2Fb')
  })

  it('getCampaign encodes the id', async () => {
    const urls = captureFetch()
    await getCampaign(conn, 'cmp/1')
    expect(urls[0]).toBe('http://server.test/campaigns/cmp%2F1')
  })

  it('getRoster → /campaigns/{id}/roster', async () => {
    const urls = captureFetch()
    await getRoster(conn, 'cmp_1')
    expect(urls[0]).toBe('http://server.test/campaigns/cmp_1/roster')
  })

  it('getChronicle passes ?limit when provided', async () => {
    const urls = captureFetch()
    await getChronicle(conn, 'cmp_1', 5)
    expect(urls[0]).toBe('http://server.test/campaigns/cmp_1/chronicle?limit=5')
  })

  it('getChronicle omits ?limit when not provided', async () => {
    const urls = captureFetch()
    await getChronicle(conn, 'cmp_1')
    expect(urls[0]).toBe('http://server.test/campaigns/cmp_1/chronicle')
  })
})

describe('M4 timeline reads', () => {
  it('listBranches → GET /worlds/{w}/branches (id encoded)', async () => {
    const urls = captureFetch()
    await listBranches(conn, 'wld/1')
    expect(urls[0]).toBe('http://server.test/worlds/wld%2F1/branches')
  })

  it('getLog defaults to no query', async () => {
    const urls = captureFetch()
    await getLog(conn, 'wld_1')
    expect(urls[0]).toBe('http://server.test/worlds/wld_1/log')
  })

  it('getLog passes ?branch= and ?limit=', async () => {
    const urls = captureFetch()
    await getLog(conn, 'wld_1', 'what-if', 10)
    expect(urls[0]).toBe('http://server.test/worlds/wld_1/log?branch=what-if&limit=10')
  })

  it('getLog passes limit=0 (a valid empty page, not dropped)', async () => {
    const urls = captureFetch()
    await getLog(conn, 'wld_1', undefined, 0)
    expect(urls[0]).toBe('http://server.test/worlds/wld_1/log?limit=0')
  })
})

describe('M4 slice 2: events + commit detail', () => {
  it('getEvents with no filters → /worlds/{w}/events', async () => {
    const urls = captureFetch()
    await getEvents(conn, 'wld_1')
    expect(urls[0]).toBe('http://server.test/worlds/wld_1/events')
  })

  it('getEvents maps entityRef→entity_ref, causedBy→caused_by, and passes all filters', async () => {
    const urls = captureFetch()
    await getEvents(conn, 'wld_1', {
      branch: 'what-if',
      type: 'ClaimRecorded',
      entityRef: 'a:hero',
      causedBy: 'player_action',
      limit: 25,
    })
    expect(urls[0]).toBe(
      'http://server.test/worlds/wld_1/events?branch=what-if&type=ClaimRecorded' +
        '&entity_ref=a%3Ahero&caused_by=player_action&limit=25',
    )
  })

  it('getCommit encodes the commit id', async () => {
    const urls = captureFetch()
    await getCommit(conn, 'wld_1', 'cmt/9')
    expect(urls[0]).toBe('http://server.test/worlds/wld_1/commits/cmt%2F9')
  })
})

describe('M4 slice 3: epistemic explorer', () => {
  it('getEpistemicState requests the operator-only claims,beliefs sections', async () => {
    const urls = captureFetch()
    await getEpistemicState(conn, 'cmp_1')
    expect(urls[0]).toBe('http://server.test/campaigns/cmp_1/state?sections=claims,beliefs')
  })
})
