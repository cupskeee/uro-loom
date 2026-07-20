import { type FormEvent, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useCommit, useEvents } from '../../api/queries'
import type { CommitDetail, EventEnvelope, EventFilters } from '../../api/types'
import { QueryBoundary } from '../../components/QueryBoundary'
import { Badge, Card, IdChip } from '../../components/ui'
import { Submit, TextField } from '../../components/forms'

/** Colour the provenance of an event by its caused_by kind. */
function causeTone(kind: string): 'neutral' | 'indigo' | 'amber' | 'red' | 'green' {
  if (kind === 'player_action') return 'indigo'
  if (kind === 'external') return 'red'
  if (kind === 'module' || kind === 'agenda') return 'amber'
  if (kind === 'history' || kind === 'system') return 'neutral'
  return 'green' // narrator, actor, …
}

export function EventRow({ e }: { e: EventEnvelope }) {
  return (
    <li className="py-2" data-testid="event-row">
      <div className="flex flex-wrap items-center gap-2">
        {e.seq != null && <span className="text-xs text-neutral-600">#{e.seq}</span>}
        <span className="font-medium text-neutral-200">{e.event_type}</span>
        <Badge tone={causeTone(e.caused_by.kind)}>{e.caused_by.kind}</Badge>
        {e.world_time.day != null ? (
          <span className="text-xs text-neutral-500">day {e.world_time.day}</span>
        ) : null}
        {e.entity_refs.map((r) => (
          <IdChip key={r}>{r}</IdChip>
        ))}
      </div>
      {Object.keys(e.payload).length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">
            payload
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-neutral-950 p-2 text-[11px] text-neutral-400">
            {JSON.stringify(e.payload, null, 2)}
          </pre>
        </details>
      )}
    </li>
  )
}

function CommitDetailView({ worldId, commitId }: { worldId: string; commitId: string }) {
  const q = useCommit(worldId, commitId)
  return (
    <Card className="p-4" data-testid="commit-detail">
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">
        Commit detail <IdChip>{commitId}</IdChip>
      </h2>
      <QueryBoundary query={q}>
        {(c: CommitDetail) => (
          <div>
            <div className="text-xs text-neutral-500">
              depth {c.depth} · parent {c.parent_id ? <IdChip>{c.parent_id}</IdChip> : '—'} · hash{' '}
              <span className="font-mono">{c.commit_hash.slice(0, 12) || '—'}</span>
            </div>
            <ol className="mt-2 divide-y divide-neutral-900">
              {c.events.map((e) => (
                <EventRow key={e.event_id} e={e} />
              ))}
            </ol>
          </div>
        )}
      </QueryBoundary>
    </Card>
  )
}

export function EventsPanel() {
  const { worldId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const commit = params.get('commit') ?? ''

  // Filter form state (applied on submit → drives the query).
  const [branch, setBranch] = useState(params.get('branch') ?? 'main')
  const [type, setType] = useState('')
  const [entityRef, setEntityRef] = useState('')
  const [causedBy, setCausedBy] = useState('')
  const [applied, setApplied] = useState<EventFilters>({ branch: params.get('branch') ?? 'main' })
  const [commitInput, setCommitInput] = useState(commit)

  const eventsQ = useEvents(worldId, applied)

  function search(e: FormEvent) {
    e.preventDefault()
    setApplied({
      branch: branch.trim() || 'main',
      type: type.trim() || undefined,
      entityRef: entityRef.trim() || undefined,
      causedBy: causedBy.trim() || undefined,
    })
  }

  function lookupCommit(e: FormEvent) {
    e.preventDefault()
    const next = new URLSearchParams(params)
    if (commitInput.trim()) next.set('commit', commitInput.trim())
    else next.delete('commit')
    setParams(next, { replace: true })
  }

  return (
    <div data-testid="events-panel" className="space-y-4">
      <Card className="p-4">
        <p className="mb-3 text-xs text-amber-200/70">
          Operator-only (D-45): the raw event log is omniscient — it carries claim truth values,
          hidden beliefs, and provenance a player never sees.
        </p>
        <form onSubmit={search} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
          <TextField label="Branch" value={branch} onChange={setBranch} testid="ev-branch" />
          <TextField
            label="Event type"
            value={type}
            onChange={setType}
            testid="ev-type"
            placeholder="ClaimRecorded"
          />
          <TextField
            label="Entity ref"
            value={entityRef}
            onChange={setEntityRef}
            testid="ev-entity"
            placeholder="a:hero"
          />
          <TextField
            label="Caused by"
            value={causedBy}
            onChange={setCausedBy}
            testid="ev-cause"
            placeholder="player_action"
          />
          <Submit testid="ev-search">Filter</Submit>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">
          Event log <span className="text-neutral-500">· {applied.branch}</span>
        </h2>
        <QueryBoundary
          query={eventsQ}
          isEmpty={(d) => d.events.length === 0}
          empty="No events match these filters."
        >
          {(d) => (
            <ol className="divide-y divide-neutral-900">
              {d.events.map((e) => (
                <EventRow key={e.event_id} e={e} />
              ))}
            </ol>
          )}
        </QueryBoundary>
      </Card>

      <Card className="p-4">
        <form onSubmit={lookupCommit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <TextField
              label="Inspect a commit id"
              value={commitInput}
              onChange={setCommitInput}
              testid="commit-input"
              placeholder="cmt_a3"
            />
          </div>
          <Submit testid="commit-lookup">Inspect</Submit>
        </form>
      </Card>

      {commit && <CommitDetailView worldId={worldId} commitId={commit} />}
    </div>
  )
}
