import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Connection } from './client'
import { getCampaign, getChronicle, getRoster, listCampaigns, listWorlds } from './endpoints'

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
