// TanStack Query hooks over the endpoint functions. Each is keyed by the server
// base URL (so switching servers refetches) plus its params, and is enabled only
// when connected. Components consume these via <QueryBoundary>.

import { useQuery } from '@tanstack/react-query'
import { useConnection } from '../config/connection'
import {
  getCampaign,
  getCampaignState,
  getChronicle,
  getCommit,
  getEvents,
  getLog,
  getRoster,
  listBranches,
  listCampaigns,
  listWorlds,
} from './endpoints'
import type { EventFilters } from './types'

export function useWorlds() {
  const { connection } = useConnection()
  return useQuery({
    queryKey: ['worlds', connection?.baseUrl],
    enabled: !!connection,
    queryFn: ({ signal }) => listWorlds(connection!, signal),
  })
}

export function useCampaigns(worldId?: string) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: ['campaigns', connection?.baseUrl, worldId ?? null],
    enabled: !!connection,
    queryFn: ({ signal }) => listCampaigns(connection!, worldId, signal),
  })
}

export function useCampaign(campaignId: string) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: ['campaign', connection?.baseUrl, campaignId],
    enabled: !!connection,
    queryFn: ({ signal }) => getCampaign(connection!, campaignId, signal),
  })
}

export function useRoster(campaignId: string) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: ['roster', connection?.baseUrl, campaignId],
    enabled: !!connection,
    queryFn: ({ signal }) => getRoster(connection!, campaignId, signal),
  })
}

export function useCampaignState(campaignId: string) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: ['state', connection?.baseUrl, campaignId],
    enabled: !!connection,
    queryFn: ({ signal }) => getCampaignState(connection!, campaignId, signal),
  })
}

export function useChronicle(campaignId: string, limit?: number) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: ['chronicle', connection?.baseUrl, campaignId, limit ?? null],
    enabled: !!connection,
    queryFn: ({ signal }) => getChronicle(connection!, campaignId, limit, signal),
  })
}

// ---- M4: timelines --------------------------------------------------------------

export function useBranches(worldId: string) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: ['branches', connection?.baseUrl, worldId],
    enabled: !!connection && !!worldId,
    queryFn: ({ signal }) => listBranches(connection!, worldId, signal),
  })
}

export function useLog(worldId: string, branch?: string, limit?: number) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: ['log', connection?.baseUrl, worldId, branch ?? 'main', limit ?? null],
    enabled: !!connection && !!worldId,
    queryFn: ({ signal }) => getLog(connection!, worldId, branch, limit, signal),
  })
}

// ---- M4 slice 2: event-log inspector + commit detail (operator-only, D-45) ------

export function useEvents(worldId: string, filters: EventFilters) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: [
      'events',
      connection?.baseUrl,
      worldId,
      filters.branch ?? 'main',
      filters.type ?? null,
      filters.entityRef ?? null,
      filters.causedBy ?? null,
      filters.limit ?? null,
    ],
    enabled: !!connection && !!worldId,
    queryFn: ({ signal }) => getEvents(connection!, worldId, filters, signal),
  })
}

export function useCommit(worldId: string, commitId: string) {
  const { connection } = useConnection()
  return useQuery({
    queryKey: ['commit', connection?.baseUrl, worldId, commitId],
    enabled: !!connection && !!worldId && !!commitId,
    queryFn: ({ signal }) => getCommit(connection!, worldId, commitId, signal),
  })
}
