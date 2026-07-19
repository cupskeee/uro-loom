// Typed errors for the uro-server wire contract. The API client maps HTTP status
// codes to these so the UI can react structurally — most importantly, a 501 means
// "this operation is not wired on the connected server" (see docs/01 §2, docs/02),
// which Loom degrades gracefully rather than treating as a hard failure.

export class ApiError extends Error {
  readonly status: number
  readonly body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** 401 — the bearer token was missing or rejected by `resolve_participant`. */
export class UnauthorizedError extends ApiError {
  constructor(body?: unknown) {
    super(401, 'Unauthorized — the bearer token was missing or rejected.', body)
    this.name = 'UnauthorizedError'
  }
}

/** 403 — token out of scope (e.g. a campaign-scoped token on the wrong campaign). */
export class ForbiddenError extends ApiError {
  constructor(body?: unknown) {
    super(403, 'Forbidden — the token is out of scope for this resource.', body)
    this.name = 'ForbiddenError'
  }
}

/** 404 — resource not found. */
export class NotFoundError extends ApiError {
  constructor(body?: unknown) {
    super(404, 'Not found.', body)
    this.name = 'NotFoundError'
  }
}

/**
 * 501 — the endpoint exists but its server-side dependency is unwired
 * (uro-server returns 501 via `_mgmt()` when a `ServerDeps` field is None).
 * Loom treats this as "not supported by this server" and degrades the surface.
 */
export class UnsupportedByServerError extends ApiError {
  constructor(body?: unknown) {
    super(501, 'This operation is not supported by the connected server.', body)
    this.name = 'UnsupportedByServerError'
  }
}

/** The request never reached the server (DNS, CORS, offline, bad URL). */
export class NetworkError extends Error {
  readonly cause?: unknown

  constructor(cause?: unknown) {
    super('Could not reach the server. Check the URL and that it is running.')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

/** True when an error means "the connected server does not offer this yet." */
export function isUnsupported(err: unknown): err is UnsupportedByServerError {
  return err instanceof UnsupportedByServerError
}
