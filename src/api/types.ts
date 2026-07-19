// Hand-written wire types matching what uro-server actually returns today (verified
// against uro-core models + the projection SQL, not docs/08 — see the wire-drift note
// in docs/02). These will be augmented by types generated from the server's OpenAPI
// schema once it exposes a stable one (`pnpm gen:api`, docs/01 §2).

/** GET /healthz — open, no auth. Body shape is not contractually pinned yet. */
export interface Health {
  status?: string
  [key: string]: unknown
}

/**
 * Optional server build/version info. uro-server does not expose a dedicated
 * version endpoint yet, so a 404 here is tolerated and rendered as "unknown".
 */
export interface ServerInfo {
  engineVersion?: string
  apiVersion?: string
  [key: string]: unknown
}

/** GET /worlds → World[]. Exactly three fields (no ruleset on the world). */
export interface World {
  world_id: string
  name: string
  main_branch_id: string
}

/**
 * GET /campaigns → Campaign[] (optional `?world_id=` filter);
 * GET /campaigns/{id} → Campaign (404 if absent).
 * `ruleset_id`/`ruleset_version` default to "" (empty = registry default, docs/06);
 * `seed` is an integer.
 */
export interface Campaign {
  campaign_id: string
  world_id: string
  branch_id: string
  ruleset_id: string
  ruleset_version: string
  seed: number
}

/**
 * GET /campaigns/{id}/roster → { pcs: string[] }.
 * `pcs` are actor-id STRINGS (not objects). NOTE: this endpoint does no existence
 * check — a missing campaign returns 200 { pcs: [] }, not 404.
 */
export interface RosterResponse {
  pcs: string[]
}

/** A row of proj_actors (branch_id stripped). */
export interface ActorRow {
  actor_id: string
  name: string
  tier: number
  role: string
  aliases: string[]
  status: string // "alive" | "dead"
}

/** A row of proj_threads. */
export interface ThreadRow {
  thread_id: string
  stakes: string
  state: string // "dormant" | "offered" | "active" | "resolved" | "dead"
  provenance: string // "author" | "ai_backfill"
}

/** A row of proj_places. */
export interface PlaceRow {
  place_id: string
  name: string
  kind: string // "region" | "settlement" | "site"
  status: string // "active" | "destroyed"
  description: string
}

/** A row of proj_factions. */
export interface FactionRow {
  faction_id: string
  name: string
  kind: string // "faction" | "religion"
  description: string
}

/**
 * GET /campaigns/{id}/state → CampaignState. Keys under `state` are exactly the
 * requested `?sections=` (default actors,threads,places,factions); each requested
 * section is always present (empty [] if none). Unknown section → HTTP 400.
 */
export interface CampaignState {
  branch_id: string
  state: {
    actors?: ActorRow[]
    threads?: ThreadRow[]
    places?: PlaceRow[]
    factions?: FactionRow[]
  }
}

/** One resolved beat — all six fields always present. `synopsis` is "" today. */
export interface BeatResolvedPayload {
  v: number
  beat_id: string
  participant_id: string
  intent_text: string
  narration: string
  synopsis: string
}

/** GET /campaigns/{id}/chronicle → { beats }. `beats` is ordered OLDEST-first. */
export interface ChronicleResponse {
  beats: BeatResolvedPayload[]
}

// ---- Write requests / responses (M3 operate) -----------------------------------

/** POST /worlds. `tone` may be a string or list; the server normalizes. */
export interface CreateWorldRequest {
  name: string
  tone?: string | string[]
}
export interface CreateWorldResponse {
  world_id: string
  main_branch_id: string
  name: string
}

/** POST /worlds/{world_id}/campaigns. Supply either new_pc_name OR adopt_actor_id. */
export interface CreateCampaignRequest {
  participant: string
  new_pc_name?: string
  adopt_actor_id?: string
  seed?: number
}
export interface CreateCampaignResponse {
  campaign_id: string
  branch_id: string
}

/** POST /campaigns/{id}/join. Returns the bound actor + (if enabled) a minted token. */
export interface JoinCampaignRequest {
  participant: string
  new_pc_name?: string
  adopt_actor_id?: string
}
export interface JoinCampaignResponse {
  actor_id: string
  token?: string
}

export interface MintTokenRequest {
  participant: string
}
export interface MintTokenResponse {
  token: string
}

export interface RevokeTokenRequest {
  token: string
}
export interface RevokeTokenResponse {
  revoked: boolean
}

export interface TimeSkipRequest {
  days: number
}
/** Shape is engine-defined; rendered generically. */
export type TimeSkipResponse = Record<string, unknown>

/** A feat within an OutcomeBundle (extra='forbid' — exactly these keys). */
export interface OutcomeFeat {
  actor: string
  description: string
}
export interface OutcomeLoot {
  item_id: string
  from_ref?: string
  to_ref?: string
}
/**
 * POST /campaigns/{id}/encounters/{encounter_id}/outcome — the OutcomeBundle v1.
 * `encounter_id` comes from the URL path (do NOT include it here). `extra='forbid'`,
 * so only these keys are allowed.
 */
export interface OutcomeBundle {
  v?: number
  participants?: string[]
  witnesses?: string[]
  casualties?: string[]
  feats?: OutcomeFeat[]
  loot?: OutcomeLoot[]
  duration_rounds?: number
}
/** The distillation result; rendered generically (commit_id + receipt entries). */
export type OutcomeResponse = Record<string, unknown>
