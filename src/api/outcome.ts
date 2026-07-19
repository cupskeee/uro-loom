import type { OutcomeBundle } from './types'

/** Split a comma-separated field into trimmed, non-empty tokens. */
export function parseCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export interface OutcomeFormFields {
  participants: string
  witnesses: string
  casualties: string
  featActor: string
  featDescription: string
  durationRounds: string
}

/**
 * Build an OutcomeBundle from the form fields, omitting empty parts. Because the
 * server model is `extra='forbid'`, we only ever set the known keys (never
 * `encounter_id` — that comes from the URL path).
 */
export function buildOutcomeBundle(f: OutcomeFormFields): OutcomeBundle {
  const bundle: OutcomeBundle = {}
  const participants = parseCsv(f.participants)
  if (participants.length) bundle.participants = participants
  const witnesses = parseCsv(f.witnesses)
  if (witnesses.length) bundle.witnesses = witnesses
  const casualties = parseCsv(f.casualties)
  if (casualties.length) bundle.casualties = casualties
  if (f.featActor.trim()) {
    bundle.feats = [{ actor: f.featActor.trim(), description: f.featDescription.trim() }]
  }
  const dr = Number(f.durationRounds)
  if (f.durationRounds.trim() && Number.isFinite(dr) && dr > 0) bundle.duration_rounds = dr
  return bundle
}
