// Typed endpoint functions over uro-server's management surface (docs/02). All the
// /campaigns and /worlds reads require a bearer token (default auth: true); only
// /healthz is open.

import { apiFetch, type Connection } from './client'
import type {
  Campaign,
  CampaignState,
  ChronicleResponse,
  Health,
  RosterResponse,
  ServerInfo,
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
