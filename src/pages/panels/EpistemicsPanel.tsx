import { useParams } from 'react-router-dom'
import { useEpistemicState } from '../../api/queries'
import type { BeliefRow, ClaimRow, EpistemicState } from '../../api/types'
import { QueryBoundary } from '../../components/QueryBoundary'
import { Badge, Card, IdChip } from '../../components/ui'

function truthTone(truth: string): 'green' | 'red' | 'amber' | 'neutral' {
  if (truth === 'true') return 'green'
  if (truth === 'false') return 'red'
  if (truth === 'unknown') return 'amber'
  return 'neutral'
}

/** One believer of a claim: who, how strongly, and from whom (the propagation chain). */
function Believer({ b }: { b: BeliefRow }) {
  const pct = Math.round(b.confidence * 100)
  return (
    <li className="flex flex-wrap items-center gap-2 py-1" data-testid="believer">
      <IdChip>{b.actor_id}</IdChip>
      <span className="inline-flex items-center gap-1">
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
          <span className="block h-full bg-indigo-500" style={{ width: `${Math.max(4, pct)}%` }} />
        </span>
        <span className="text-xs text-neutral-500">{pct}%</span>
      </span>
      {b.learned_from ? (
        <span className="text-xs text-neutral-600">
          ← learned from <IdChip>{b.learned_from}</IdChip>
        </span>
      ) : (
        <span className="text-xs text-neutral-700">firsthand</span>
      )}
    </li>
  )
}

function ClaimCard({ claim, believers }: { claim: ClaimRow; believers: BeliefRow[] }) {
  return (
    <Card className="p-4" data-testid="claim-card">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={truthTone(claim.truth)}>truth: {claim.truth}</Badge>
        <span className="text-xs text-neutral-500">{claim.origin}</span>
        <span className="ml-auto text-xs text-neutral-600">day {claim.created_day}</span>
      </div>
      <div className="mt-2 text-sm text-neutral-200">“{claim.statement}”</div>
      {claim.subject_refs.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {claim.subject_refs.map((r) => (
            <IdChip key={r}>{r}</IdChip>
          ))}
        </div>
      )}
      <div className="mt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Believed by ({believers.length})
        </h4>
        {believers.length === 0 ? (
          <p className="mt-1 text-xs text-neutral-600">
            Not yet propagated — canon/testimony no actor holds a belief about.
          </p>
        ) : (
          <ul className="mt-1">
            {believers.map((b) => (
              <Believer key={`${b.actor_id}:${b.claim_id}`} b={b} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

export function EpistemicsPanel() {
  const { campaignId = '' } = useParams()
  const query = useEpistemicState(campaignId)

  return (
    <div data-testid="epistemics-panel" className="space-y-4">
      <p className="text-xs text-amber-200/70">
        Operator-only (D-46): the epistemic layer — claim <em>truth</em> values and every actor’s
        hidden beliefs — is the omniscient ground truth a player never reads.
      </p>
      <QueryBoundary
        query={query}
        isEmpty={(d: EpistemicState) => (d.state.claims?.length ?? 0) === 0}
        empty="No claims recorded on this branch yet."
      >
        {(d) => {
          const claims = d.state.claims ?? []
          const beliefs = d.state.beliefs ?? []
          const byClaim = new Map<string, BeliefRow[]>()
          for (const b of beliefs) {
            const list = byClaim.get(b.claim_id) ?? []
            list.push(b)
            byClaim.set(b.claim_id, list)
          }
          return (
            <div className="grid gap-3 lg:grid-cols-2">
              {claims.map((c) => (
                <ClaimCard key={c.claim_id} claim={c} believers={byClaim.get(c.claim_id) ?? []} />
              ))}
            </div>
          )
        }}
      </QueryBoundary>
    </div>
  )
}
