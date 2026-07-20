import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useCampaign } from '../api/queries'
import { QueryBoundary } from '../components/QueryBoundary'
import { Badge, Card, IdChip } from '../components/ui'

const tab = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-3 py-2 text-sm ${
    isActive
      ? 'border-indigo-400 text-neutral-100'
      : 'border-transparent text-neutral-400 hover:text-neutral-200'
  }`

export function CampaignDetailPage() {
  const { campaignId = '' } = useParams()
  const query = useCampaign(campaignId)

  return (
    <section data-testid="campaign-detail">
      <QueryBoundary query={query}>
        {(c) => (
          <Card className="mb-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold">Campaign</h1>
              <IdChip>{c.campaign_id}</IdChip>
              <Badge tone="indigo">
                {c.ruleset_id
                  ? `${c.ruleset_id}${c.ruleset_version ? ` @${c.ruleset_version}` : ''}`
                  : 'default ruleset'}
              </Badge>
              <span className="text-xs text-neutral-500">seed {c.seed}</span>
            </div>
            <div className="mt-2 text-xs text-neutral-600">
              world <IdChip>{c.world_id}</IdChip> · branch <IdChip>{c.branch_id}</IdChip>
            </div>
          </Card>
        )}
      </QueryBoundary>

      <nav className="mb-4 flex gap-1 border-b border-neutral-800">
        <NavLink to="." end className={tab}>
          Overview
        </NavLink>
        <NavLink to="play" className={tab}>
          Play
        </NavLink>
        <NavLink to="roster" className={tab}>
          Roster
        </NavLink>
        <NavLink to="state" className={tab}>
          State
        </NavLink>
        <NavLink to="epistemics" className={tab}>
          Epistemics
        </NavLink>
        <NavLink to="preview" className={tab}>
          Preview
        </NavLink>
        <NavLink to="chronicle" className={tab}>
          Chronicle
        </NavLink>
        <NavLink to="codex" className={tab}>
          Codex
        </NavLink>
        <NavLink to="manage" className={tab}>
          Manage
        </NavLink>
      </nav>

      <Outlet />
    </section>
  )
}
