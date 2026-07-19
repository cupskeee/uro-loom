import { NavLink, Outlet } from 'react-router-dom'
import { useConnection } from '../config/connection'
import { HealthBadge } from './HealthBadge'

const navItem = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm ${
    isActive ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
  }`

export function Layout() {
  const { connection, disconnect } = useConnection()

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="font-semibold">Uro Loom</span>
          <nav className="flex items-center gap-1">
            <NavLink to="/worlds" className={navItem}>
              Worlds
            </NavLink>
            <NavLink to="/campaigns" className={navItem}>
              Campaigns
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-neutral-500 sm:inline">{connection?.baseUrl}</span>
          <HealthBadge />
          <button
            data-testid="disconnect"
            onClick={disconnect}
            className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            Disconnect
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
