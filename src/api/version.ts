// The uro-server wire-contract version Loom targets. Uro is pre-1.0 and does not
// yet publish a machine-readable API version, so this is a documentation anchor
// for now (decision LD-5). When the server exposes one, compareApiVersion() is the
// hook to warn on a mismatch before the user hits confusing 404/422 errors.

export const TARGET_API_VERSION = '0'

/** Returns true when the server's advertised API version is one Loom supports. */
export function isCompatibleApiVersion(serverVersion: string | undefined): boolean {
  // Pre-1.0: accept anything (including unknown). Tighten once the server pins it.
  if (!serverVersion) return true
  return serverVersion.split('.')[0] === TARGET_API_VERSION
}
