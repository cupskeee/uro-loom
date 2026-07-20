import { type FormEvent, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useConsistency } from '../../api/queries'
import { useDryRun } from '../../api/mutations'
import { errorMessage } from '../../api/errors'
import type { ConsistencyResponse } from '../../api/types'
import { QueryBoundary } from '../../components/QueryBoundary'
import { Badge, Card } from '../../components/ui'
import { Feedback, Submit } from '../../components/forms'
import { EventRow } from './EventsPanel'

function ConsistencyCard() {
  const { campaignId = '' } = useParams()
  const query = useConsistency(campaignId)
  return (
    <Card className="p-4" data-testid="consistency-card">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-200">Consistency</h2>
        <span className="text-xs text-neutral-500">narrator contradiction-survival proxy (T2)</span>
      </div>
      <QueryBoundary query={query}>
        {(c: ConsistencyResponse) => {
          const pct = Math.round(c.ratio * 100)
          const tone = pct >= 90 ? 'green' : pct >= 70 ? 'amber' : 'red'
          return (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Badge tone={tone}>{pct}%</Badge>
              <span className="text-sm text-neutral-300">
                {c.consistent} / {c.total} narrator claims survived
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
                <span
                  className="block h-full bg-indigo-500"
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </span>
            </div>
          )
        }}
      </QueryBoundary>
    </Card>
  )
}

export function PreviewPanel() {
  const { campaignId = '' } = useParams()
  const m = useDryRun(campaignId)
  const [intent, setIntent] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    m.reset()
    m.mutate({ intent: intent.trim() })
  }

  return (
    <div data-testid="preview-panel" className="space-y-4">
      <ConsistencyCard />

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-neutral-200">Preview a beat (dry-run)</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Runs the full pipeline and shows the events a beat <em>would</em> commit — writing
          nothing. Intent-only (no client plan, D-37).
        </p>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <textarea
            data-testid="dryrun-intent"
            value={intent}
            onChange={(ev) => setIntent(ev.target.value)}
            required
            rows={2}
            placeholder="I kick down the door and challenge the warlord."
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <div className="flex items-center gap-3">
            <Submit pending={m.isPending} testid="dryrun-submit">
              Preview beat
            </Submit>
            <Feedback
              testid="dryrun-feedback"
              error={m.isError ? errorMessage(m.error) : null}
              success={
                m.isSuccess ? (
                  <span>{m.data.events.length} event(s) — nothing committed</span>
                ) : null
              }
            />
          </div>
        </form>

        {m.isSuccess && m.data.events.length > 0 && (
          <ol className="mt-3 divide-y divide-neutral-900" data-testid="dryrun-events">
            {m.data.events.map((e) => (
              <EventRow key={e.event_id} e={e} />
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
