import { Link, useParams } from 'react-router-dom'
import { useCampaign } from '../../api/queries'
import { QueryBoundary } from '../../components/QueryBoundary'
import { Card } from '../../components/ui'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-900 py-2 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="font-mono text-neutral-300">{value}</span>
    </div>
  )
}

export function OverviewPanel() {
  const { campaignId = '' } = useParams()
  const query = useCampaign(campaignId)

  return (
    <QueryBoundary query={query}>
      {(c) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-4 text-sm">
            <div className="mb-2 font-medium text-neutral-200">Identity</div>
            <Row label="campaign_id" value={c.campaign_id} />
            <Row label="world_id" value={c.world_id} />
            <Row label="branch_id" value={c.branch_id} />
            <Row
              label="ruleset"
              value={
                c.ruleset_id ? `${c.ruleset_id} @${c.ruleset_version || '—'}` : 'registry default'
              }
            />
            <Row label="seed" value={c.seed != null ? String(c.seed) : '— (operator only)'} />
          </Card>
          <Card className="p-4 text-sm">
            <div className="mb-2 font-medium text-neutral-200">Explore</div>
            <ul className="space-y-1 text-indigo-300">
              <li>
                <Link to="roster" className="hover:text-indigo-200">
                  Roster — bound player characters →
                </Link>
              </li>
              <li>
                <Link to="state" className="hover:text-indigo-200">
                  State — actors, places, threads, factions →
                </Link>
              </li>
              <li>
                <Link to="chronicle" className="hover:text-indigo-200">
                  Chronicle — the narrated history →
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      )}
    </QueryBoundary>
  )
}
