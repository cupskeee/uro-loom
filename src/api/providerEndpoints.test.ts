import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Connection } from './client'
import {
  createConnection,
  createCredential,
  deleteConnection,
  deleteCredential,
  deleteRoleBinding,
  getProviders,
  refreshConnection,
  reloadRouter,
  testConnection,
  setConnectionEnabled,
  setRoleBinding,
} from './endpoints'

const conn: Connection = { baseUrl: 'http://s.test', token: 'op' }

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

describe('provider registry endpoints (D-47)', () => {
  it('getProviders GETs /providers', async () => {
    const calls = capture()
    await getProviders(conn)
    expect(calls[0].url).toBe('http://s.test/providers')
    expect(calls[0].init.method ?? 'GET').toBe('GET')
  })

  it('createConnection POSTs a JSON body to /providers', async () => {
    const calls = capture()
    await createConnection(conn, { name: 'oai', provider: 'openai', auth_id: 'cred_1' })
    expect(calls[0].url).toBe('http://s.test/providers')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      name: 'oai',
      provider: 'openai',
      auth_id: 'cred_1',
    })
  })

  it('setConnectionEnabled PATCHes /providers/{id} with is_enabled', async () => {
    const calls = capture()
    await setConnectionEnabled(conn, 'conn_1', false)
    expect(calls[0].url).toBe('http://s.test/providers/conn_1')
    expect(calls[0].init.method).toBe('PATCH')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ is_enabled: false })
  })

  it('deleteConnection DELETEs /providers/{id}', async () => {
    const calls = capture()
    await deleteConnection(conn, 'conn/1')
    expect(calls[0].url).toBe('http://s.test/providers/conn%2F1') // id is encoded
    expect(calls[0].init.method).toBe('DELETE')
  })

  it('createCredential POSTs the plaintext key to /providers/credentials', async () => {
    const calls = capture()
    await createCredential(conn, { provider: 'openai', access_token: 'sk-x' })
    expect(calls[0].url).toBe('http://s.test/providers/credentials')
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      provider: 'openai',
      access_token: 'sk-x',
    })
  })

  it('deleteCredential DELETEs /providers/credentials/{id}', async () => {
    const calls = capture()
    await deleteCredential(conn, 'cred_1')
    expect(calls[0].url).toBe('http://s.test/providers/credentials/cred_1')
    expect(calls[0].init.method).toBe('DELETE')
  })

  it('setRoleBinding PUTs /providers/roles/{role}', async () => {
    const calls = capture()
    await setRoleBinding(conn, 'narrator', { connection_id: 'conn_1', model: 'gpt-4o' })
    expect(calls[0].url).toBe('http://s.test/providers/roles/narrator')
    expect(calls[0].init.method).toBe('PUT')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      connection_id: 'conn_1',
      model: 'gpt-4o',
    })
  })

  it('deleteRoleBinding DELETEs /providers/roles/{role}', async () => {
    const calls = capture()
    await deleteRoleBinding(conn, 'narrator')
    expect(calls[0].url).toBe('http://s.test/providers/roles/narrator')
    expect(calls[0].init.method).toBe('DELETE')
  })

  it('refreshConnection POSTs /providers/{id}/refresh', async () => {
    const calls = capture()
    await refreshConnection(conn, 'conn_1')
    expect(calls[0].url).toBe('http://s.test/providers/conn_1/refresh')
    expect(calls[0].init.method).toBe('POST')
  })

  it('testConnection POSTs /providers/{id}/test with the model', async () => {
    const calls = capture()
    await testConnection(conn, 'conn_1', 'gpt-4o')
    expect(calls[0].url).toBe('http://s.test/providers/conn_1/test')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ model: 'gpt-4o' })
  })

  it('reloadRouter POSTs /providers/reload', async () => {
    const calls = capture()
    await reloadRouter(conn)
    expect(calls[0].url).toBe('http://s.test/providers/reload')
    expect(calls[0].init.method).toBe('POST')
  })
})
