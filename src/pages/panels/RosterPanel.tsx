import { useParams } from 'react-router-dom'
import { useRoster } from '../../api/queries'
import { QueryBoundary } from '../../components/QueryBoundary'
import { Card, IdChip } from '../../components/ui'

export function RosterPanel() {
  const { campaignId = '' } = useParams()
  const query = useRoster(campaignId)

  return (
    <QueryBoundary
      query={query}
      isEmpty={(r) => r.pcs.length === 0}
      empty="No player characters are bound on this campaign's branch."
    >
      {(roster) => (
        <Card className="p-4" data-testid="roster-panel">
          <div className="mb-2 text-sm text-neutral-400">
            {roster.pcs.length} player character{roster.pcs.length === 1 ? '' : 's'}
          </div>
          <ul className="space-y-1">
            {roster.pcs.map((actorId) => (
              <li key={actorId} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden />
                <IdChip>{actorId}</IdChip>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </QueryBoundary>
  )
}
