import { type FormEvent, useState } from 'react'
import { useExtractionPolicy, useRulesets, useUsage } from '../api/queries'
import { useSetExtractionPolicy } from '../api/mutations'
import type { ExtractionPolicy, RulesetInfo, RulesetsResponse, UsageResponse } from '../api/types'
import { QueryBoundary } from '../components/QueryBoundary'
import { Badge, Card, IdChip, PageHeading } from '../components/ui'
import { Submit, TextField } from '../components/forms'

// The emergent categories play can create (D-49). `warn` = the engine relies on it (recall).
const EXTRACTION_CATEGORIES: {
  key: keyof ExtractionPolicy
  label: string
  desc: string
  warn?: boolean
}[] = [
  {
    key: 'extract_actors',
    label: 'Actors',
    desc: 'People who appear in play (an innkeeper, a stranger) become tracked actors.',
  },
  {
    key: 'extract_places',
    label: 'Places',
    desc: 'Named locations the scene visits (a tavern, a town, a ruin) become tracked places — also created when an actor is located there.',
  },
  {
    key: 'extract_factions',
    label: 'Factions',
    desc: 'Named groups (a house, order, guild, church) become tracked factions — also created when an actor is a member of one (D-50).',
  },
  {
    key: 'extract_threads',
    label: 'Threads',
    desc: 'Live plots and conflicts named in play become tracked threads. Never deduplicated — two similar plots may legitimately coexist (D-50).',
  },
  {
    key: 'extract_claims',
    label: 'Claims & Beliefs',
    desc: 'Facts about the world and who-believes-what. ⚠ The engine NEEDS these for recall — disabling degrades continuity and long-range memory.',
    warn: true,
  },
]

function ExtractionPolicyPanel() {
  const query = useExtractionPolicy()
  const set = useSetExtractionPolicy()
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">
        Extraction policy{' '}
        <span className="text-neutral-500">· what PLAY may create (operator, D-49/D-50)</span>
      </h2>
      <QueryBoundary query={query}>
        {(policy: ExtractionPolicy) => (
          <Card className="space-y-3 p-4" data-testid="extraction-policy">
            {EXTRACTION_CATEGORIES.map((c) => (
              <label key={c.key} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={policy[c.key]}
                  disabled={set.isPending}
                  onChange={(e) => set.mutate({ [c.key]: e.target.checked })}
                  data-testid={`policy-${c.key}`}
                  className="mt-1 h-4 w-4 accent-indigo-500"
                />
                <div>
                  <div className="font-medium text-neutral-200">{c.label}</div>
                  <div className={c.warn ? 'text-xs text-amber-400' : 'text-xs text-neutral-500'}>
                    {c.desc}
                  </div>
                </div>
              </label>
            ))}
            <div className="border-t border-neutral-800 pt-3 text-xs text-neutral-500">
              Emergent world is <span className="text-neutral-400">relational</span> (D-50): an
              actor cascade-creates the faction it belongs to and the place it&rsquo;s in, so two
              same-named figures of different houses stay distinct.
            </div>
          </Card>
        )}
      </QueryBoundary>
    </div>
  )
}

function RulesetCard({ r }: { r: RulesetInfo }) {
  const props = (r.sheet_schema?.properties ?? {}) as Record<string, unknown>
  const keys = Object.keys(props)
  return (
    <Card className="p-4" data-testid="ruleset-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-neutral-200">{r.id}</span>
        <Badge tone="indigo">@{r.version}</Badge>
        <span className="text-xs text-neutral-500">
          {typeof r.sheet_schema?.title === 'string' ? r.sheet_schema.title : 'sheet'}
        </span>
      </div>
      {keys.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1" data-testid="ruleset-fields">
          {keys.map((k) => (
            <IdChip key={k}>{k}</IdChip>
          ))}
        </div>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">
          sheet schema
        </summary>
        <pre className="mt-1 overflow-x-auto rounded bg-neutral-950 p-2 text-[11px] text-neutral-400">
          {JSON.stringify(r.sheet_schema, null, 2)}
        </pre>
      </details>
    </Card>
  )
}

function RulesetViewer() {
  const query = useRulesets()
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-neutral-200">
        Ruleset registry <span className="text-neutral-500">· id@version + sheet shape</span>
      </h2>
      <QueryBoundary
        query={query}
        isEmpty={(d: RulesetsResponse) => d.rulesets.length === 0}
        empty="No rulesets registered."
      >
        {(d) => (
          <div className="grid gap-3 sm:grid-cols-2">
            {d.rulesets.map((r) => (
              <RulesetCard key={`${r.id}@${r.version}`} r={r} />
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}

function UsageDashboard() {
  const [stage, setStage] = useState('')
  const [applied, setApplied] = useState<string | undefined>(undefined)
  const query = useUsage(applied)

  function filter(e: FormEvent) {
    e.preventDefault()
    setApplied(stage.trim() || undefined)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <h2 className="text-sm font-semibold text-neutral-200">
          Usage <span className="text-neutral-500">· LLM-call telemetry (operator, D-44)</span>
        </h2>
        <form onSubmit={filter} className="ml-auto flex items-end gap-2">
          <div className="w-40">
            <TextField
              label="Stage filter"
              value={stage}
              onChange={setStage}
              testid="usage-stage"
              placeholder="narrator"
            />
          </div>
          <Submit testid="usage-filter">Filter</Submit>
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            data-testid="usage-refresh"
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
          >
            {query.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </form>
      </div>
      <QueryBoundary query={query}>
        {(d: UsageResponse) => (
          <Card className="p-4" data-testid="usage-result">
            <div className="mb-3 text-sm text-neutral-300">
              <span className="font-medium">{d.total_calls.toLocaleString()}</span> total calls
              {d.stage ? <span className="text-neutral-500"> · stage “{d.stage}”</span> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-1 pr-4">stage</th>
                    <th className="py-1 pr-4">model</th>
                    <th className="py-1 pr-4 text-right">calls</th>
                    <th className="py-1 pr-4 text-right">tokens in</th>
                    <th className="py-1 pr-4 text-right">tokens out</th>
                    <th className="py-1 text-right">avg ms</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-300">
                  {d.by_stage.map((r, i) => (
                    <tr key={`${r.stage_tag}-${r.model ?? 'null'}-${i}`} data-testid="usage-row">
                      <td className="py-1 pr-4">{r.stage_tag}</td>
                      <td className="py-1 pr-4 text-neutral-500">{r.model ?? '—'}</td>
                      <td className="py-1 pr-4 text-right">{r.calls.toLocaleString()}</td>
                      <td className="py-1 pr-4 text-right">{r.tokens_in.toLocaleString()}</td>
                      <td className="py-1 pr-4 text-right">{r.tokens_out.toLocaleString()}</td>
                      <td className="py-1 text-right">{r.avg_latency_ms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </QueryBoundary>
    </div>
  )
}

export function OpsPage() {
  return (
    <section data-testid="ops-page" className="space-y-6">
      <PageHeading
        title="Ops"
        subtitle="Registered rulesets (public) and LLM-call telemetry (operator). The engine exposes metering; billing/quota is the consumer's job (docs/00)."
      />
      <RulesetViewer />
      <ExtractionPolicyPanel />
      <UsageDashboard />
    </section>
  )
}
