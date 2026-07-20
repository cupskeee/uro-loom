// The single fetch choke point between Loom and uro-server. Everything else in
// src/api/ builds on apiFetch. It owns: base-URL normalization, bearer auth, JSON
// encode/decode, and mapping HTTP status codes to the typed errors in ./errors.
//
// Loom couples ONLY to this wire contract — never to uro-core, never to Postgres
// (docs/01 §2, decision LD-3).

import {
  ApiError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  UnauthorizedError,
  UnsupportedByServerError,
} from './errors'

export interface Connection {
  /** Base URL of the uro-server, e.g. "http://127.0.0.1:8000". */
  baseUrl: string
  /** Bearer token (a Uro participant/operator credential), or null for none. */
  token: string | null
}

export interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  /**
   * Send the bearer token as `Authorization: Bearer <token>`. Default true.
   * Pass false for open endpoints like `/healthz` (which take no auth).
   */
  auth?: boolean
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, '')
}

/** Map an HTTP status to a typed error. Pure — unit-tested directly. */
export function mapError(status: number, body?: unknown): ApiError {
  switch (status) {
    case 401:
      return new UnauthorizedError(body)
    case 403:
      return new ForbiddenError(body)
    case 404:
      return new NotFoundError(body)
    case 501:
      return new UnsupportedByServerError(body)
    default:
      return new ApiError(status, `Request failed with HTTP ${status}.`, body)
  }
}

async function readBody(res: Pick<Response, 'text'>): Promise<unknown> {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export async function apiFetch<T>(
  conn: Connection,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, signal, auth = true } = opts
  // A FormData body (a multipart pack upload) is sent as-is: the browser sets the
  // multipart Content-Type + boundary, so we must NOT set it or JSON-encode.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (auth && conn.token) headers['Authorization'] = `Bearer ${conn.token}`

  let res: Response
  try {
    res = await fetch(`${normalizeBase(conn.baseUrl)}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch (cause) {
    // fetch rejects only on network-level failure; HTTP errors resolve normally.
    throw new NetworkError(cause)
  }

  if (!res.ok) {
    throw mapError(res.status, await readBody(res))
  }
  if (res.status === 204) {
    return undefined as T
  }
  return (await readBody(res)) as T
}
