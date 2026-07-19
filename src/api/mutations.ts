// TanStack Query mutation hooks over the write endpoints. Each closes over the
// active connection and invalidates the read queries it affects, so the observe
// surfaces refresh after an operation.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection } from '../config/connection'
import {
  createCampaign,
  createWorld,
  joinCampaign,
  mintToken,
  reportOutcome,
  revokeToken,
  timeSkip,
} from './endpoints'
import type {
  CreateCampaignRequest,
  CreateWorldRequest,
  JoinCampaignRequest,
  MintTokenRequest,
  OutcomeBundle,
  RevokeTokenRequest,
  TimeSkipRequest,
} from './types'

export function useCreateWorld() {
  const { connection } = useConnection()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateWorldRequest) => createWorld(connection!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['worlds'] }),
  })
}

export function useCreateCampaign(worldId: string) {
  const { connection } = useConnection()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateCampaignRequest) => createCampaign(connection!, worldId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}

export function useJoinCampaign(campaignId: string) {
  const { connection } = useConnection()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: JoinCampaignRequest) => joinCampaign(connection!, campaignId, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['roster', connection?.baseUrl, campaignId] }),
  })
}

export function useMintToken(campaignId: string) {
  const { connection } = useConnection()
  return useMutation({
    mutationFn: (body: MintTokenRequest) => mintToken(connection!, campaignId, body),
  })
}

export function useRevokeToken(campaignId: string) {
  const { connection } = useConnection()
  return useMutation({
    mutationFn: (body: RevokeTokenRequest) => revokeToken(connection!, campaignId, body),
  })
}

export function useTimeSkip(campaignId: string) {
  const { connection } = useConnection()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TimeSkipRequest) => timeSkip(connection!, campaignId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['state', connection?.baseUrl, campaignId] })
      qc.invalidateQueries({ queryKey: ['chronicle', connection?.baseUrl, campaignId] })
    },
  })
}

export function useReportOutcome(campaignId: string) {
  const { connection } = useConnection()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { encounterId: string; bundle: OutcomeBundle }) =>
      reportOutcome(connection!, campaignId, args.encounterId, args.bundle),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chronicle', connection?.baseUrl, campaignId] })
      qc.invalidateQueries({ queryKey: ['state', connection?.baseUrl, campaignId] })
    },
  })
}
