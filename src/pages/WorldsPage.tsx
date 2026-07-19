import { Link } from 'react-router-dom'
import { useWorlds } from '../api/queries'
import { QueryBoundary } from '../components/QueryBoundary'
import { Card, IdChip, PageHeading } from '../components/ui'

export function WorldsPage() {
  const query = useWorlds()

  return (
    <section data-testid="worlds-page">
      <PageHeading title="Worlds" subtitle="Every world this server knows about." />
      <QueryBoundary
        query={query}
        isEmpty={(worlds) => worlds.length === 0}
        empty="No worlds yet. Create one with `uro world new` or import a pack, then refresh."
      >
        {(worlds) => (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {worlds.map((w) => (
              <li key={w.world_id}>
                <Link
                  to={`/campaigns?world=${encodeURIComponent(w.world_id)}`}
                  className="block h-full"
                  data-testid="world-card"
                >
                  <Card className="h-full p-4 transition hover:border-neutral-600">
                    <div className="font-medium">{w.name}</div>
                    <div className="mt-1">
                      <IdChip>{w.world_id}</IdChip>
                    </div>
                    <div className="mt-2 text-xs text-neutral-600">
                      main branch <IdChip>{w.main_branch_id}</IdChip>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </section>
  )
}
