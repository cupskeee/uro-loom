// Typed endpoint functions over uro-server's management surface (docs/02). All the
// /campaigns and /worlds reads require a bearer token (default auth: true); only
// /healthz is open.

import { apiFetch, type Connection } from './client'
import type {
  BackfillResponse,
  BranchesResponse,
  Campaign,
  CampaignState,
  ChronicleResponse,
  CommitDetail,
  ConsistencyResponse,
  CreateCampaignRequest,
  CreateCampaignResponse,
  CreateMarkerRequest,
  CreateWorldRequest,
  CreateWorldResponse,
  DryRunRequest,
  DryRunResponse,
  EpistemicState,
  EventFilters,
  EventsResponse,
  ForkRequest,
  ForkResponse,
  Health,
  ImportWorldResponse,
  JoinCampaignRequest,
  JoinCampaignResponse,
  LogResponse,
  Marker,
  MintTokenRequest,
  ProbeResponse,
  ValidateResponse,
  MintTokenResponse,
  OutcomeBundle,
  OutcomeResponse,
  RevokeTokenRequest,
  RevokeTokenResponse,
  RosterResponse,
  ServerInfo,
  TimeSkipRequest,
  TimeSkipResponse,
  World,
  WorldBundle,
} from './types'

const enc = encodeURIComponent

/** GET /healthz — open (no auth). Resolves iff the server is reachable and 2xx. */
export function getHealth(conn: Connection, signal?: AbortSignal): Promise<Health> {
  return apiFetch<Health>(conn, '/healthz', { auth: false, signal })
}

/** GET /version — optional; callers tolerate a 404/501 and render "unknown". */
export function getServerInfo(conn: Connection, signal?: AbortSignal): Promise<ServerInfo> {
  return apiFetch<ServerInfo>(conn, '/version', { auth: false, signal })
}

/** GET /worlds → World[]. */
export function listWorlds(conn: Connection, signal?: AbortSignal): Promise<World[]> {
  return apiFetch<World[]>(conn, '/worlds', { signal })
}

/** GET /campaigns[?world_id=] → Campaign[]. */
export function listCampaigns(
  conn: Connection,
  worldId?: string,
  signal?: AbortSignal,
): Promise<Campaign[]> {
  const q = worldId ? `?world_id=${enc(worldId)}` : ''
  return apiFetch<Campaign[]>(conn, `/campaigns${q}`, { signal })
}

/** GET /campaigns/{id} → Campaign (404 if absent). */
export function getCampaign(
  conn: Connection,
  campaignId: string,
  signal?: AbortSignal,
): Promise<Campaign> {
  return apiFetch<Campaign>(conn, `/campaigns/${enc(campaignId)}`, { signal })
}

/** GET /campaigns/{id}/roster → { pcs: string[] }. Never 404s (empty for missing). */
export function getRoster(
  conn: Connection,
  campaignId: string,
  signal?: AbortSignal,
): Promise<RosterResponse> {
  return apiFetch<RosterResponse>(conn, `/campaigns/${enc(campaignId)}/roster`, { signal })
}

/** GET /campaigns/{id}/state → CampaignState (default sections; 404 if absent). */
export function getCampaignState(
  conn: Connection,
  campaignId: string,
  signal?: AbortSignal,
): Promise<CampaignState> {
  return apiFetch<CampaignState>(conn, `/campaigns/${enc(campaignId)}/state`, { signal })
}

/** GET /campaigns/{id}/chronicle[?limit=] → { beats } (oldest-first; 404 if absent). */
export function getChronicle(
  conn: Connection,
  campaignId: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<ChronicleResponse> {
  const q = limit ? `?limit=${limit}` : ''
  return apiFetch<ChronicleResponse>(conn, `/campaigns/${enc(campaignId)}/chronicle${q}`, {
    signal,
  })
}

/**
 * GET /campaigns/{id}/state?sections=claims,beliefs — the epistemic layer (claims'
 * truth values + who believes them). OPERATOR-only (D-46): a player token → 403.
 */
export function getEpistemicState(
  conn: Connection,
  campaignId: string,
  signal?: AbortSignal,
): Promise<EpistemicState> {
  return apiFetch<EpistemicState>(
    conn,
    `/campaigns/${enc(campaignId)}/state?sections=claims,beliefs`,
    { signal },
  )
}

/** GET /campaigns/{id}/consistency → the T2 contradiction-survival proxy. Any-authed. */
export function getConsistency(
  conn: Connection,
  campaignId: string,
  signal?: AbortSignal,
): Promise<ConsistencyResponse> {
  return apiFetch<ConsistencyResponse>(conn, `/campaigns/${enc(campaignId)}/consistency`, {
    signal,
  })
}

// ---- M4: timelines (world-scoped reads) ----------------------------------------

/** GET /worlds/{world_id}/branches → { branches, markers }. Any-authed (404 if absent). */
export function listBranches(
  conn: Connection,
  worldId: string,
  signal?: AbortSignal,
): Promise<BranchesResponse> {
  return apiFetch<BranchesResponse>(conn, `/worlds/${enc(worldId)}/branches`, { signal })
}

/** GET /worlds/{world_id}/log[?branch=&limit=] → { branch, commits }. Any-authed. */
export function getLog(
  conn: Connection,
  worldId: string,
  branch?: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<LogResponse> {
  const params = new URLSearchParams()
  if (branch) params.set('branch', branch)
  if (limit != null) params.set('limit', String(limit))
  const q = params.toString()
  return apiFetch<LogResponse>(conn, `/worlds/${enc(worldId)}/log${q ? `?${q}` : ''}`, { signal })
}

/**
 * GET /worlds/{world_id}/events — the raw event log along a branch, filterable.
 * OPERATOR-only (D-45): the raw log is omniscient. A player token → 403.
 */
export function getEvents(
  conn: Connection,
  worldId: string,
  filters: EventFilters = {},
  signal?: AbortSignal,
): Promise<EventsResponse> {
  const params = new URLSearchParams()
  if (filters.branch) params.set('branch', filters.branch)
  if (filters.type) params.set('type', filters.type)
  if (filters.entityRef) params.set('entity_ref', filters.entityRef)
  if (filters.causedBy) params.set('caused_by', filters.causedBy)
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const q = params.toString()
  return apiFetch<EventsResponse>(conn, `/worlds/${enc(worldId)}/events${q ? `?${q}` : ''}`, {
    signal,
  })
}

/** GET /worlds/{world_id}/commits/{commit_id} → one commit's events. OPERATOR-only (D-45). */
export function getCommit(
  conn: Connection,
  worldId: string,
  commitId: string,
  signal?: AbortSignal,
): Promise<CommitDetail> {
  return apiFetch<CommitDetail>(conn, `/worlds/${enc(worldId)}/commits/${enc(commitId)}`, {
    signal,
  })
}

// ---- Writes (M3 operate + M4 timeline writes) ----------------------------------

/** POST /worlds — create a world. */
export function createWorld(
  conn: Connection,
  body: CreateWorldRequest,
): Promise<CreateWorldResponse> {
  return apiFetch<CreateWorldResponse>(conn, '/worlds', { method: 'POST', body })
}

/** POST /worlds/{world_id}/campaigns — start a campaign in a world. */
export function createCampaign(
  conn: Connection,
  worldId: string,
  body: CreateCampaignRequest,
): Promise<CreateCampaignResponse> {
  return apiFetch<CreateCampaignResponse>(conn, `/worlds/${enc(worldId)}/campaigns`, {
    method: 'POST',
    body,
  })
}

/** POST /campaigns/{id}/join — seat a participant on a PC. */
export function joinCampaign(
  conn: Connection,
  campaignId: string,
  body: JoinCampaignRequest,
): Promise<JoinCampaignResponse> {
  return apiFetch<JoinCampaignResponse>(conn, `/campaigns/${enc(campaignId)}/join`, {
    method: 'POST',
    body,
  })
}

/** POST /campaigns/{id}/tokens — mint a durable token for a seated participant. */
export function mintToken(
  conn: Connection,
  campaignId: string,
  body: MintTokenRequest,
): Promise<MintTokenResponse> {
  return apiFetch<MintTokenResponse>(conn, `/campaigns/${enc(campaignId)}/tokens`, {
    method: 'POST',
    body,
  })
}

/** POST /campaigns/{id}/tokens/revoke — revoke a token. */
export function revokeToken(
  conn: Connection,
  campaignId: string,
  body: RevokeTokenRequest,
): Promise<RevokeTokenResponse> {
  return apiFetch<RevokeTokenResponse>(conn, `/campaigns/${enc(campaignId)}/tokens/revoke`, {
    method: 'POST',
    body,
  })
}

/** POST /campaigns/{id}/time-skip — advance in-fiction time (+ agenda tick). */
export function timeSkip(
  conn: Connection,
  campaignId: string,
  body: TimeSkipRequest,
): Promise<TimeSkipResponse> {
  return apiFetch<TimeSkipResponse>(conn, `/campaigns/${enc(campaignId)}/time-skip`, {
    method: 'POST',
    body,
  })
}

/** POST /campaigns/{id}/encounters/{encounter_id}/outcome — Chronicler ingest. */
export function reportOutcome(
  conn: Connection,
  campaignId: string,
  encounterId: string,
  bundle: OutcomeBundle,
): Promise<OutcomeResponse> {
  return apiFetch<OutcomeResponse>(
    conn,
    `/campaigns/${enc(campaignId)}/encounters/${enc(encounterId)}/outcome`,
    { method: 'POST', body: bundle },
  )
}

/** POST /worlds/{world_id}/branches — fork a branch (OPERATOR-only, D-44). */
export function forkBranch(
  conn: Connection,
  worldId: string,
  body: ForkRequest,
): Promise<ForkResponse> {
  return apiFetch<ForkResponse>(conn, `/worlds/${enc(worldId)}/branches`, {
    method: 'POST',
    body,
  })
}

/** POST /worlds/{world_id}/markers — name a branch head (OPERATOR-only, D-44). */
export function createMarker(
  conn: Connection,
  worldId: string,
  body: CreateMarkerRequest,
): Promise<Marker> {
  return apiFetch<Marker>(conn, `/worlds/${enc(worldId)}/markers`, { method: 'POST', body })
}

/**
 * POST /campaigns/{id}/dry-run — preview the events a beat WOULD commit, writing
 * nothing. Any-authed; INTENT-ONLY (no client plan=, D-37).
 */
export function dryRun(
  conn: Connection,
  campaignId: string,
  body: DryRunRequest,
): Promise<DryRunResponse> {
  return apiFetch<DryRunResponse>(conn, `/campaigns/${enc(campaignId)}/dry-run`, {
    method: 'POST',
    body,
  })
}

// ---- M5 slice 1: pack authoring (multipart .zip upload) ------------------------

function packForm(file: File): FormData {
  const fd = new FormData()
  fd.append('pack', file, file.name)
  return fd
}

/** POST /worlds/validate — grade an uploaded pack (parse-only, any-authed, BE-6). */
export function validatePack(conn: Connection, file: File): Promise<ValidateResponse> {
  return apiFetch<ValidateResponse>(conn, '/worlds/validate', {
    method: 'POST',
    body: packForm(file),
  })
}

/** POST /worlds/backfill — AI gap-fill preview (OPERATOR-only, commits nothing, BE-7). */
export function backfillPack(conn: Connection, file: File): Promise<BackfillResponse> {
  return apiFetch<BackfillResponse>(conn, '/worlds/backfill', {
    method: 'POST',
    body: packForm(file),
  })
}

/** POST /worlds/probe[?tries=] — model-capability report (OPERATOR-only, BE-7). */
export function probePack(conn: Connection, file: File, tries?: number): Promise<ProbeResponse> {
  const q = tries != null ? `?tries=${tries}` : ''
  return apiFetch<ProbeResponse>(conn, `/worlds/probe${q}`, {
    method: 'POST',
    body: packForm(file),
  })
}

/** GET /worlds/{world_id}/export → the world's hash-chained bundle (OPERATOR-only, D-45). */
export function exportWorld(
  conn: Connection,
  worldId: string,
  signal?: AbortSignal,
): Promise<WorldBundle> {
  return apiFetch<WorldBundle>(conn, `/worlds/${enc(worldId)}/export`, { signal })
}

/**
 * POST /worlds/import — verify a bundle's hash chain, then instantiate a fresh world
 * (OPERATOR-only, D-44). A tampered/malformed bundle → 400 before any write.
 */
export function importWorld(conn: Connection, bundle: WorldBundle): Promise<ImportWorldResponse> {
  return apiFetch<ImportWorldResponse>(conn, '/worlds/import', { method: 'POST', body: bundle })
}
