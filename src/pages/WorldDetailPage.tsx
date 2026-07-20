import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { useWorlds } from '../api/queries'
import { Card, IdChip } from '../components/ui'

const tab = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-3 py-2 text-sm ${
    isActive
      ? 'border-indigo-400 text-neutral-100'
      : 'border-transparent text-neutral-400 hover:text-neutral-200'
  }`

/**
 * A world's workspace (M4). The header resolves the world's name from the worlds
 * list (there is no single-world GET). Timeline is the first tab; the event
 * inspector + epistemic explorer land as further tabs in later M4 slices.
 */
export function WorldDetailPage() {
  const { worldId = '' } = useParams()
  const worlds = useWorlds()
  const world = worlds.data?.find((w) => w.world_id === worldId)

  return (
    <section data-testid="world-detail">
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold">{world?.name ?? 'World'}</h1>
          <IdChip>{worldId}</IdChip>
          <Link
            to={`/campaigns?world=${encodeURIComponent(worldId)}`}
            className="ml-auto text-xs text-indigo-300 hover:text-indigo-200"
          >
            campaigns →
          </Link>
        </div>
      </Card>

      <nav className="mb-4 flex gap-1 border-b border-neutral-800">
        <NavLink to="." end className={tab}>
          Timeline
        </NavLink>
      </nav>

      <Outlet />
    </section>
  )
}
