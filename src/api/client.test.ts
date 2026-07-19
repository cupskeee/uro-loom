import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, mapError, type Connection } from './client'
import {
  ApiError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  UnauthorizedError,
  UnsupportedByServerError,
  isUnsupported,
} from './errors'

const conn: Connection = { baseUrl: 'http://server.test', token: 'tok' }

/** Minimal Response-shaped stub — avoids depending on a global Response impl. */
function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mapError', () => {
  it('maps 401 → UnauthorizedError', () => {
    expect(mapError(401)).toBeInstanceOf(UnauthorizedError)
  })
  it('maps 403 → ForbiddenError', () => {
    expect(mapError(403)).toBeInstanceOf(ForbiddenError)
  })
  it('maps 404 → NotFoundError', () => {
    expect(mapError(404)).toBeInstanceOf(NotFoundError)
  })
  it('maps 501 → UnsupportedByServerError (the graceful-degradation path)', () => {
    const err = mapError(501)
    expect(err).toBeInstanceOf(UnsupportedByServerError)
    expect(isUnsupported(err)).toBe(true)
  })
  it('maps other statuses → ApiError carrying the status', () => {
    const err = mapError(500, { detail: 'boom' })
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(500)
    expect(err.body).toEqual({ detail: 'boom' })
  })
})

describe('apiFetch', () => {
  it('resolves the parsed JSON body on 2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeResponse(200, { status: 'ok' })),
    )
    await expect(apiFetch(conn, '/healthz', { auth: false })).resolves.toEqual({ status: 'ok' })
  })

  it('throws UnsupportedByServerError on 501', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeResponse(501, { detail: 'unwired' })),
    )
    await expect(apiFetch(conn, '/usage')).rejects.toBeInstanceOf(UnsupportedByServerError)
  })

  it('throws UnauthorizedError on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeResponse(401, { detail: 'no token' })),
    )
    await expect(apiFetch(conn, '/worlds')).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('wraps a network failure in NetworkError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('failed to fetch')
      }),
    )
    await expect(apiFetch(conn, '/worlds')).rejects.toBeInstanceOf(NetworkError)
  })

  it('sends the bearer token when auth is on, omits it when off', async () => {
    const calls: RequestInit[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls.push(init ?? {})
        return fakeResponse(200, {})
      }),
    )

    await apiFetch(conn, '/worlds')
    await apiFetch(conn, '/healthz', { auth: false })

    const authedHeaders = calls[0].headers as unknown as Record<string, string>
    const openHeaders = calls[1].headers as unknown as Record<string, string>
    expect(authedHeaders['Authorization']).toBe('Bearer tok')
    expect(openHeaders['Authorization']).toBeUndefined()
  })

  it('strips trailing slashes from the base URL', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        return fakeResponse(200, {})
      }),
    )
    await apiFetch({ baseUrl: 'http://server.test/', token: null }, '/healthz', { auth: false })
    expect(urls[0]).toBe('http://server.test/healthz')
  })
})
