// Typed endpoint functions. M0 only needs liveness + optional server info; M1+
// adds worlds/campaigns/roster/state/chronicle here (see docs/02 feature-parity).

import { apiFetch, type Connection } from './client'
import type { Health, ServerInfo } from './types'

/** GET /healthz — open (no auth). Resolves iff the server is reachable and 2xx. */
export function getHealth(conn: Connection, signal?: AbortSignal): Promise<Health> {
  return apiFetch<Health>(conn, '/healthz', { auth: false, signal })
}

/**
 * GET /version — optional. Not all servers expose it; callers should tolerate a
 * NotFoundError / UnsupportedByServerError and render "unknown".
 */
export function getServerInfo(conn: Connection, signal?: AbortSignal): Promise<ServerInfo> {
  return apiFetch<ServerInfo>(conn, '/version', { auth: false, signal })
}
