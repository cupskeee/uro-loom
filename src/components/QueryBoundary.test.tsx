import { render, screen } from '@testing-library/react'
import type { UseQueryResult } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { QueryBoundary } from './QueryBoundary'
import { ApiError, UnsupportedByServerError } from '../api/errors'

/** Build a minimal UseQueryResult-shaped stub for the fields QueryBoundary reads. */
function fakeQuery<T>(partial: Partial<UseQueryResult<T>>): UseQueryResult<T> {
  return {
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
    refetch: () => Promise.resolve({}),
    ...partial,
  } as unknown as UseQueryResult<T>
}

describe('QueryBoundary', () => {
  it('shows the loading label while pending', () => {
    render(
      <QueryBoundary query={fakeQuery<number>({ isPending: true })} loadingLabel="Loading worlds…">
        {(n) => <div>{n}</div>}
      </QueryBoundary>,
    )
    expect(screen.getByText('Loading worlds…')).toBeInTheDocument()
  })

  it('degrades gracefully on a 501 (UnsupportedByServerError)', () => {
    render(
      <QueryBoundary
        query={fakeQuery<number>({ isError: true, error: new UnsupportedByServerError() })}
      >
        {(n) => <div>{n}</div>}
      </QueryBoundary>,
    )
    expect(screen.getByText('Not supported by this server')).toBeInTheDocument()
  })

  it('shows a real error (not the unsupported panel) for other failures', () => {
    render(
      <QueryBoundary query={fakeQuery<number>({ isError: true, error: new ApiError(500, 'boom') })}>
        {(n) => <div>{n}</div>}
      </QueryBoundary>,
    )
    expect(screen.getByText('Couldn’t load')).toBeInTheDocument()
    expect(screen.queryByText('Not supported by this server')).not.toBeInTheDocument()
  })

  it('shows the empty state when isEmpty matches', () => {
    render(
      <QueryBoundary
        query={fakeQuery<number[]>({ data: [] })}
        isEmpty={(d) => d.length === 0}
        empty="Nothing here."
      >
        {() => <div>rows</div>}
      </QueryBoundary>,
    )
    expect(screen.getByText('Nothing here.')).toBeInTheDocument()
  })

  it('renders children with data on success', () => {
    render(
      <QueryBoundary query={fakeQuery<string>({ data: 'hello' })}>
        {(s) => <div>value: {s}</div>}
      </QueryBoundary>,
    )
    expect(screen.getByText('value: hello')).toBeInTheDocument()
  })
})
