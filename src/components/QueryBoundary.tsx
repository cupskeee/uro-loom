import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { isUnsupported } from '../api/errors'

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>
  /** Render when data has loaded successfully. */
  children: (data: T) => ReactNode
  /** Optional: treat this loaded value as "empty" and show the empty state. */
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
  loadingLabel?: string
}

/**
 * Uniform loading / error / empty handling for a TanStack Query. The important
 * case is a 501 (UnsupportedByServerError): the connected uro-server does not wire
 * this endpoint, which Loom shows as an informational "not supported" panel rather
 * than a red error — the graceful-degradation contract from docs/01 §2 / LD-5.
 */
export function QueryBoundary<T>({
  query,
  children,
  isEmpty,
  empty,
  loadingLabel = 'Loading…',
}: QueryBoundaryProps<T>) {
  if (query.isPending) {
    return <div className="p-6 text-sm text-neutral-500">{loadingLabel}</div>
  }

  if (query.isError) {
    if (isUnsupported(query.error)) {
      return (
        <div className="m-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-6 text-sm text-neutral-400">
          <div className="font-medium text-neutral-300">Not supported by this server</div>
          <p className="mt-1">
            The connected uro-server doesn’t expose this endpoint yet. See the backend co-evolution
            items (BE-1…BE-11) in the plan.
          </p>
        </div>
      )
    }
    return (
      <div className="m-6 rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-300">
        <div className="font-medium">Couldn’t load</div>
        <p className="mt-1 break-words">{String(query.error)}</p>
        <button
          onClick={() => query.refetch()}
          className="mt-3 rounded-md border border-red-800 px-3 py-1 text-xs text-red-200 hover:bg-red-900/40"
        >
          Retry
        </button>
      </div>
    )
  }

  if (isEmpty?.(query.data)) {
    return (
      <div className="m-6 rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-500">
        {empty ?? 'Nothing here yet.'}
      </div>
    )
  }

  return <>{children(query.data)}</>
}
