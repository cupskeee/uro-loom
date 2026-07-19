import { useConnection } from './config/connection'
import { ConnectionScreen } from './components/ConnectionScreen'
import { HealthBadge } from './components/HealthBadge'

export function App() {
  const { connection, disconnect } = useConnection()

  if (!connection) {
    return <ConnectionScreen />
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Uro Loom</span>
          <span className="text-xs text-neutral-500">{connection.baseUrl}</span>
        </div>
        <div className="flex items-center gap-3">
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

      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-lg font-medium">Connected.</h2>
        <p className="mt-2 text-sm text-neutral-400">
          This is the M0 foundation — a health-checked connection to your Uro server.
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          M1 adds the world browser, campaign list, roster, state, and chronicle. See{' '}
          <code className="text-neutral-300">docs/04-plan.md</code>.
        </p>
      </main>
    </div>
  )
}
