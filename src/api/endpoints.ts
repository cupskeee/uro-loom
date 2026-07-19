// Typed endpoint functions over uro-server's management surface (docs/02). All the
// /campaigns and /worlds reads require a bearer token (default auth: true); only
// /healthz is open.

import { apiFetch, type Connection } from './client'
import type {
  Campaign,
  CampaignState,
  ChronicleResponse,
  CreateCampaignRequest,
  CreateCampaignResponse,
  CreateWorldRequest,
  CreateWorldResponse,
  Health,
  JoinCampaignRequest,
  JoinCampaignResponse,
  MintTokenRequest,
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

// ---- Writes (M3 operate) -------------------------------------------------------

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
