// TanStack Query mutation hooks over the write endpoints. Each closes over the
// active connection and invalidates the read queries it affects, so the observe
// surfaces refresh after an operation.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConnection } from '../config/connection'
import {
  backfillPack,
  createCampaign,
  createMarker,
  createWorld,
  dryRun,
  exportWorld,
  forkBranch,
  importWorld,
  joinCampaign,
  mintToken,
  probePack,
  validatePack,
  reportOutcome,
  revokeToken,
  timeSkip,
} from './endpoints'
import type {
  CreateCampaignRequest,
  WorldBundle,
  CreateMarkerRequest,
  CreateWorldRequest,
  DryRunRequest,
  ForkRequest,
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

// ---- M4: timeline writes (operator-only, D-44) ----------------------------------

export function useForkBranch(worldId: string) {
  const { connection } = useConnection()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ForkRequest) => forkBranch(connection!, worldId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches', connection?.baseUrl, worldId] }),
  })
}

export function useCreateMarker(worldId: string) {
  const { connection } = useConnection()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateMarkerRequest) => createMarker(connection!, worldId, body),
    onSuccess: () => {
      // a marker anchors on a branch head → both the tree and that branch's log show it
      qc.invalidateQueries({ queryKey: ['branches', connection?.baseUrl, worldId] })
      qc.invalidateQueries({ queryKey: ['log', connection?.baseUrl, worldId] })
    },
  })
}

// ---- M4 slice 4: dry-run (a beat preview; commits nothing, so no invalidation) --

export function useDryRun(campaignId: string) {
  const { connection } = useConnection()
  return useMutation({
    mutationFn: (body: DryRunRequest) => dryRun(connection!, campaignId, body),
  })
}

// ---- M5 slice 1: pack authoring (upload → validate / backfill / probe) ----------
// These operate on an uploaded pack file, not stored world state, so no invalidation.

export function useValidatePack() {
  const { connection } = useConnection()
  return useMutation({ mutationFn: (file: File) => validatePack(connection!, file) })
}

export function useBackfillPack() {
  const { connection } = useConnection()
  return useMutation({ mutationFn: (file: File) => backfillPack(connection!, file) })
}

export function useProbePack() {
  const { connection } = useConnection()
  return useMutation({
    mutationFn: (args: { file: File; tries?: number }) =>
      probePack(connection!, args.file, args.tries),
  })
}

// ---- M5 slice 2: export / import (bundle portability) ---------------------------

export function useExportWorld() {
  const { connection } = useConnection()
  return useMutation({ mutationFn: (worldId: string) => exportWorld(connection!, worldId) })
}

export function useImportWorld() {
  const { connection } = useConnection()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bundle: WorldBundle) => importWorld(connection!, bundle),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['worlds'] }),
  })
}
