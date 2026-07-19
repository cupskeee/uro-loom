import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useCampaignState } from '../../api/queries'
import type { ActorRow, FactionRow, PlaceRow, ThreadRow } from '../../api/types'
import { QueryBoundary } from '../../components/QueryBoundary'
import { Badge, Card, IdChip } from '../../components/ui'

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <span className="text-sm font-medium text-neutral-200">{title}</span>
        <span className="text-xs text-neutral-500">{count}</span>
      </div>
      {count === 0 ? (
        <div className="px-4 py-3 text-sm text-neutral-600">none</div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </Card>
  )
}

function statusTone(status: string) {
  if (status === 'alive' || status === 'active') return 'green' as const
  if (status === 'dead' || status === 'destroyed') return 'red' as const
  return 'neutral' as const
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-2 text-left font-medium">{children}</th>
}

export function StatePanel() {
  const { campaignId = '' } = useParams()
  const query = useCampaignState(campaignId)

  return (
    <QueryBoundary query={query}>
      {({ state }) => {
        const actors: ActorRow[] = state.actors ?? []
        const places: PlaceRow[] = state.places ?? []
        const threads: ThreadRow[] = state.threads ?? []
        const factions: FactionRow[] = state.factions ?? []
        return (
          <div className="grid gap-4" data-testid="state-panel">
            <Section title="Actors" count={actors.length}>
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-800 text-xs text-neutral-500">
                  <tr>
                    <Th>Name</Th>
                    <Th>Tier</Th>
                    <Th>Role</Th>
                    <Th>Aliases</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {actors.map((a) => (
                    <tr key={a.actor_id} className="border-b border-neutral-900 last:border-0">
                      <td className="px-4 py-2">
                        <div className="text-neutral-200">{a.name}</div>
                        <IdChip>{a.actor_id}</IdChip>
                      </td>
                      <td className="px-4 py-2 text-neutral-400">T{a.tier}</td>
                      <td className="px-4 py-2 text-neutral-400">{a.role || '—'}</td>
                      <td className="px-4 py-2 text-neutral-400">{a.aliases.join(', ') || '—'}</td>
                      <td className="px-4 py-2">
                        <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Places" count={places.length}>
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-800 text-xs text-neutral-500">
                  <tr>
                    <Th>Name</Th>
                    <Th>Kind</Th>
                    <Th>Status</Th>
                    <Th>Description</Th>
                  </tr>
                </thead>
                <tbody>
                  {places.map((p) => (
                    <tr key={p.place_id} className="border-b border-neutral-900 last:border-0">
                      <td className="px-4 py-2">
                        <div className="text-neutral-200">{p.name}</div>
                        <IdChip>{p.place_id}</IdChip>
                      </td>
                      <td className="px-4 py-2">
                        <Badge>{p.kind}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-2 text-neutral-400">{p.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Threads" count={threads.length}>
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-800 text-xs text-neutral-500">
                  <tr>
                    <Th>Stakes</Th>
                    <Th>State</Th>
                    <Th>Provenance</Th>
                  </tr>
                </thead>
                <tbody>
                  {threads.map((t) => (
                    <tr key={t.thread_id} className="border-b border-neutral-900 last:border-0">
                      <td className="px-4 py-2">
                        <div className="text-neutral-200">{t.stakes}</div>
                        <IdChip>{t.thread_id}</IdChip>
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={statusTone(t.state)}>{t.state}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={t.provenance === 'ai_backfill' ? 'amber' : 'neutral'}>
                          {t.provenance}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Factions" count={factions.length}>
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-800 text-xs text-neutral-500">
                  <tr>
                    <Th>Name</Th>
                    <Th>Kind</Th>
                    <Th>Description</Th>
                  </tr>
                </thead>
                <tbody>
                  {factions.map((f) => (
                    <tr key={f.faction_id} className="border-b border-neutral-900 last:border-0">
                      <td className="px-4 py-2">
                        <div className="text-neutral-200">{f.name}</div>
                        <IdChip>{f.faction_id}</IdChip>
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={f.kind === 'religion' ? 'indigo' : 'neutral'}>{f.kind}</Badge>
                      </td>
                      <td className="px-4 py-2 text-neutral-400">{f.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>
        )
      }}
    </QueryBoundary>
  )
}
