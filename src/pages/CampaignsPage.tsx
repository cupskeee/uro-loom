import { Link, useSearchParams } from 'react-router-dom'
import { useCampaigns } from '../api/queries'
import { QueryBoundary } from '../components/QueryBoundary'
import { Badge, Card, IdChip, PageHeading } from '../components/ui'

export function CampaignsPage() {
  const [params] = useSearchParams()
  const worldId = params.get('world') ?? undefined
  const query = useCampaigns(worldId)

  return (
    <section data-testid="campaigns-page">
      <PageHeading
        title="Campaigns"
        subtitle={worldId ? undefined : 'Every play-through on this server.'}
        actions={
          worldId ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-neutral-500">world</span>
              <Badge tone="indigo">{worldId}</Badge>
              <Link to="/campaigns" className="text-xs text-neutral-400 hover:text-neutral-200">
                clear
              </Link>
            </div>
          ) : undefined
        }
      />
      <QueryBoundary
        query={query}
        isEmpty={(campaigns) => campaigns.length === 0}
        empty={
          worldId
            ? 'No campaigns in this world yet.'
            : 'No campaigns yet. Start one with `uro campaign new`.'
        }
      >
        {(campaigns) => (
          <Card>
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Campaign</th>
                  <th className="px-4 py-2 font-medium">World</th>
                  <th className="px-4 py-2 font-medium">Ruleset</th>
                  <th className="px-4 py-2 font-medium">Seed</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.campaign_id}
                    className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/60"
                  >
                    <td className="px-4 py-2">
                      <Link
                        to={`/campaigns/${encodeURIComponent(c.campaign_id)}`}
                        className="text-indigo-300 hover:text-indigo-200"
                        data-testid="campaign-row"
                      >
                        {c.campaign_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <IdChip>{c.world_id}</IdChip>
                    </td>
                    <td className="px-4 py-2 text-neutral-300">
                      {c.ruleset_id ? (
                        <>
                          {c.ruleset_id}
                          {c.ruleset_version && (
                            <span className="text-neutral-600"> @{c.ruleset_version}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-neutral-600">registry default</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-neutral-400">{c.seed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </QueryBoundary>
    </section>
  )
}
