import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useBranches, useLog } from '../../api/queries'
import { useCreateMarker, useForkBranch } from '../../api/mutations'
import { errorMessage, isForbidden } from '../../api/errors'
import type { BranchInfo, LogEntry, Marker } from '../../api/types'
import { QueryBoundary } from '../../components/QueryBoundary'
import { Badge, Card, IdChip } from '../../components/ui'
import { Feedback, Submit, TextField } from '../../components/forms'

/** Render a write error, mapping a 403 to the operator-token hint (D-44). */
function writeError(err: unknown): string {
  if (isForbidden(err)) {
    return 'Operator token required — reconnect with an --admin-token credential (D-44).'
  }
  return errorMessage(err)
}

function ForkForm({ worldId, prefillRef }: { worldId: string; prefillRef: string }) {
  const m = useForkBranch(worldId)
  const [fromRef, setFromRef] = useState(prefillRef)
  const [name, setName] = useState('')
  const [days, setDays] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    m.reset()
    const time_skip_days = days.trim() ? Number(days) : undefined
    m.mutate({ from_ref: fromRef.trim(), name: name.trim(), time_skip_days })
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="fork-form">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField
          label="From (commit id or marker name)"
          value={fromRef}
          onChange={setFromRef}
          required
          testid="fork-from"
          placeholder="pre-strike"
        />
        <TextField
          label="New branch name"
          value={name}
          onChange={setName}
          required
          testid="fork-name"
          placeholder="what-if"
        />
        <TextField
          label="Time-skip days (optional)"
          value={days}
          onChange={setDays}
          type="number"
          testid="fork-days"
          placeholder="0"
        />
      </div>
      <div className="flex items-center gap-3">
        <Submit pending={m.isPending} testid="fork-submit">
          Fork branch
        </Submit>
        <Feedback
          testid="fork-feedback"
          error={m.isError ? writeError(m.error) : null}
          success={
            m.isSuccess ? (
              <span>
                forked <IdChip>{m.data.branch_id}</IdChip> at{' '}
                <IdChip>{m.data.head_commit ?? '—'}</IdChip>
                {m.data.world_day != null ? ` · day ${m.data.world_day}` : ''}
              </span>
            ) : null
          }
        />
      </div>
    </form>
  )
}

function MarkerForm({ worldId, branch }: { worldId: string; branch: string }) {
  const m = useCreateMarker(worldId)
  const [name, setName] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    m.reset()
    m.mutate({ name: name.trim(), branch })
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3" data-testid="marker-form">
      <div className="min-w-[12rem] flex-1">
        <TextField
          label={`Marker name (on ${branch}'s head)`}
          value={name}
          onChange={setName}
          required
          testid="marker-name"
          placeholder="pre-strike"
        />
      </div>
      <Submit pending={m.isPending} testid="marker-submit">
        Add marker
      </Submit>
      <Feedback
        testid="marker-feedback"
        error={m.isError ? writeError(m.error) : null}
        success={m.isSuccess ? <span>marked at {m.data.commit_id}</span> : null}
      />
    </form>
  )
}

function BranchRow({
  branch,
  selected,
  onSelect,
}: {
  branch: BranchInfo
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      data-testid="branch-row"
      className={`block w-full rounded-md border p-3 text-left transition ${
        selected
          ? 'border-indigo-500/60 bg-indigo-950/20'
          : 'border-neutral-800 hover:border-neutral-600'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{branch.name}</span>
        {branch.forked_from ? <Badge tone="amber">fork</Badge> : <Badge tone="indigo">main</Badge>}
        <span className="ml-auto text-xs text-neutral-500">day {branch.world_day}</span>
      </div>
      <div className="mt-1 text-xs text-neutral-600">
        head <IdChip>{branch.head_commit ?? '—'}</IdChip> · depth {branch.head_depth}
        {branch.forked_from ? (
          <>
            {' '}
            · from <IdChip>{branch.forked_from}</IdChip>
          </>
        ) : null}
      </div>
    </button>
  )
}

function LogRow({ entry }: { entry: LogEntry }) {
  return (
    <li className="flex gap-3 py-2" data-testid="log-row">
      <div className="mt-0.5 flex flex-col items-center">
        <span className="text-xs text-neutral-500">{entry.depth}</span>
        <span className="mt-1 h-full w-px bg-neutral-800" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <IdChip>{entry.commit_id}</IdChip>
          {entry.markers.map((mk) => (
            <Badge key={mk} tone="green">
              ⚑ {mk}
            </Badge>
          ))}
          <Link
            to={`events?commit=${encodeURIComponent(entry.commit_id)}`}
            className="ml-auto text-xs text-indigo-300 hover:text-indigo-200"
            data-testid="inspect-commit"
          >
            inspect →
          </Link>
        </div>
        <div className="mt-1 text-sm text-neutral-300">{entry.summary || '(no summary)'}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {entry.event_types.map((t, i) => (
            <span key={`${t}-${i}`} className="text-[10px] text-neutral-600">
              {t}
            </span>
          ))}
        </div>
      </div>
    </li>
  )
}

export function TimelinePanel() {
  const { worldId = '' } = useParams()
  const branchesQ = useBranches(worldId)
  const [selected, setSelected] = useState('main')
  const [forking, setForking] = useState(false)
  const [marking, setMarking] = useState(false)
  const logQ = useLog(worldId, selected)

  return (
    <div data-testid="timeline-panel" className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-200">Branches</h2>
            <button
              data-testid="toggle-fork"
              onClick={() => setForking((v) => !v)}
              className="ml-auto rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              {forking ? 'close' : '+ fork'}
            </button>
            <button
              data-testid="toggle-marker"
              onClick={() => setMarking((v) => !v)}
              className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              {marking ? 'close' : '+ marker'}
            </button>
          </div>
          <QueryBoundary
            query={branchesQ}
            isEmpty={(d) => d.branches.length === 0}
            empty="No branches — this world has no timeline yet."
          >
            {(d) => {
              const head =
                d.branches.find((b) => b.name === selected)?.head_commit ??
                d.branches[0]?.head_commit ??
                ''
              return (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {d.branches.map((b) => (
                      <BranchRow
                        key={b.branch_id}
                        branch={b}
                        selected={b.name === selected}
                        onSelect={() => setSelected(b.name)}
                      />
                    ))}
                  </div>
                  {forking && (
                    <div className="rounded-md border border-neutral-800 p-3">
                      <ForkForm worldId={worldId} prefillRef={head} />
                    </div>
                  )}
                  {marking && (
                    <div className="rounded-md border border-neutral-800 p-3">
                      <MarkerForm worldId={worldId} branch={selected} />
                    </div>
                  )}
                  <Markers markers={d.markers} />
                </div>
              )
            }}
          </QueryBoundary>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">
          Commit log <span className="text-neutral-500">· {selected}</span>
        </h2>
        <QueryBoundary
          query={logQ}
          isEmpty={(d) => d.entries.length === 0}
          empty="No commits on this branch."
        >
          {(d) => (
            <ol className="divide-y divide-neutral-900">
              {d.entries.map((c) => (
                <LogRow key={c.commit_id} entry={c} />
              ))}
            </ol>
          )}
        </QueryBoundary>
      </Card>
    </div>
  )
}

function Markers({ markers }: { markers: Marker[] }) {
  if (markers.length === 0) return null
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Markers
      </h3>
      <ul className="flex flex-wrap gap-2" data-testid="markers">
        {markers.map((mk) => (
          <li key={mk.marker_id} className="flex items-center gap-1">
            <Badge tone="green">⚑ {mk.name}</Badge>
            <IdChip>{mk.commit_id}</IdChip>
          </li>
        ))}
      </ul>
    </div>
  )
}
