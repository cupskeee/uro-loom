import { useQuery } from '@tanstack/react-query'
import { getHealth, getServerInfo } from '../api/endpoints'
import { useConnection } from '../config/connection'

type Status = 'ok' | 'error' | 'loading'

export function HealthBadge() {
  const { connection } = useConnection()

  const health = useQuery({
    queryKey: ['health', connection?.baseUrl],
    enabled: !!connection,
    queryFn: ({ signal }) => getHealth(connection!, signal),
    refetchInterval: 15_000,
    retry: false,
  })

  // Optional server version — tolerated to fail (many servers have no /version).
  const info = useQuery({
    queryKey: ['server-info', connection?.baseUrl],
    enabled: !!connection,
    queryFn: ({ signal }) => getServerInfo(connection!, signal),
    retry: false,
  })

  const status: Status = health.isSuccess ? 'ok' : health.isError ? 'error' : 'loading'

  const color =
    status === 'ok' ? 'bg-emerald-500' : status === 'error' ? 'bg-red-500' : 'bg-amber-400'

  const label = status === 'ok' ? 'connected' : status === 'error' ? 'unreachable' : 'connecting…'

  const version =
    info.data?.engineVersion ?? info.data?.apiVersion ?? (info.isFetched ? 'version unknown' : '')

  return (
    <div
      data-testid="health-badge"
      data-status={status}
      className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-200"
      title={health.isError ? String(health.error) : undefined}
    >
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
      <span>{label}</span>
      {version && <span className="text-neutral-500">· {version}</span>}
    </div>
  )
}
