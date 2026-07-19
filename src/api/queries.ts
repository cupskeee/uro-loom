// TanStack Query hooks over the endpoint functions. Each is keyed by the server
// base URL (so switching servers refetches) plus its params, and is enabled only
// when connected. Components consume these via <QueryBoundary>.

import { useQuery } from '@tanstack/react-query'
import { useConnection } from '../config/connection'
import {
  getCampaign,
  getCampaignState,
  getChronicle,
  getRoster,
  listCampaigns,
  listWorlds,
} from './endpoints'

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
