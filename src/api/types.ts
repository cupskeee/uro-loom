// Hand-written wire types for the endpoints Loom uses today. These will be
// replaced/augmented by types generated from the server's OpenAPI schema once it
// exposes a stable one (`pnpm gen:api`, docs/01 §2). Kept intentionally loose
// (index signatures) where the exact server payload is not yet pinned.

/** GET /healthz — open, no auth. Body shape is not contractually pinned yet. */
export interface Health {
  status?: string
  [key: string]: unknown
}

/**
 * Optional server build/version info. uro-server does not expose a dedicated
 * version endpoint yet (the CLI `uro version` prints package versions), so a 404
 * here is tolerated and rendered as "unknown". Tracked as a backend item.
 */
export interface ServerInfo {
  engineVersion?: string
  apiVersion?: string
  [key: string]: unknown
}
