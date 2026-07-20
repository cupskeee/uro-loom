import { type ChangeEvent, type FormEvent, useState } from 'react'
import { useBackfillPack, useProbePack, useValidatePack } from '../api/mutations'
import { errorMessage, isForbidden } from '../api/errors'
import type { BackfillResponse, ProbeResponse, ValidateResponse } from '../api/types'
import { Badge, Card, IdChip, PageHeading } from '../components/ui'
import { Feedback, Submit } from '../components/forms'

/** A 403 on an operator-only authoring stage → the admin-token hint (D-44). */
function writeError(err: unknown): string {
  if (isForbidden(err)) {
    return 'Operator token required — reconnect with an --admin-token credential (D-44).'
  }
  return errorMessage(err)
}

function gradeTone(grade: string): 'green' | 'amber' | 'red' | 'neutral' {
  if (grade === 'runnable') return 'green'
  if (grade === 'thin') return 'amber'
  if (grade === 'insufficient') return 'red'
  return 'neutral'
}

function statusTone(s: string): 'green' | 'amber' | 'red' | 'neutral' {
  if (s === 'pass') return 'green'
  if (s === 'warn') return 'amber'
  if (s === 'fail') return 'red'
  return 'neutral'
}

function ValidateCard({ file }: { file: File | null }) {
  const m = useValidatePack()
  function run(e: FormEvent) {
    e.preventDefault()
    m.reset()
    if (file) m.mutate(file)
  }
  return (
    <Card className="p-4">
      <form onSubmit={run} className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-200">Validate</h2>
        <span className="text-xs text-neutral-500">sufficiency grade + gaps · any-authed</span>
        <span className="ml-auto">
          <Submit pending={m.isPending} disabled={!file} testid="validate-run">
            Validate
          </Submit>
        </span>
      </form>
      {!file && <p className="mt-2 text-xs text-neutral-600">Select a pack .zip above.</p>}
      <Feedback testid="validate-feedback" error={m.isError ? writeError(m.error) : null} />
      {m.isSuccess && <ValidateResult r={m.data} />}
    </Card>
  )
}

function ValidateResult({ r }: { r: ValidateResponse }) {
  return (
    <div className="mt-3 space-y-2" data-testid="validate-result">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{r.name}</span>
        <Badge tone={gradeTone(r.grade)}>{r.grade}</Badge>
        <span className="text-xs text-neutral-500">
          {r.counts.places}p · {r.counts.actors}a · {r.counts.factions}f · {r.counts.threads}t
        </span>
        <Badge tone={r.ruleset_ok ? 'green' : 'red'}>
          ruleset {r.ruleset_id || '(default)'} {r.ruleset_ok ? '✓' : '✗'}
        </Badge>
      </div>
      <ul className="space-y-1">
        {r.dimensions.map((d) => (
          <li key={d.name} className="flex items-start gap-2 text-xs">
            <span className={d.ok ? 'text-emerald-400' : 'text-amber-400'}>
              {d.ok ? 'ok' : 'GAP'}
            </span>
            <span className="w-24 text-neutral-400">{d.name}</span>
            <span className="text-neutral-500">{d.detail}</span>
          </li>
        ))}
      </ul>
      {r.gaps.length > 0 && (
        <div className="text-xs text-amber-300/80">
          gaps: <span className="text-neutral-400">{r.gaps.join(' · ')}</span>
        </div>
      )}
    </div>
  )
}

function BackfillCard({ file }: { file: File | null }) {
  const m = useBackfillPack()
  function run(e: FormEvent) {
    e.preventDefault()
    m.reset()
    if (file) m.mutate(file)
  }
  return (
    <Card className="p-4">
      <form onSubmit={run} className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-200">Backfill</h2>
        <span className="text-xs text-neutral-500">AI gap-fill preview · operator · LLM</span>
        <span className="ml-auto">
          <Submit pending={m.isPending} disabled={!file} testid="backfill-run">
            Backfill
          </Submit>
        </span>
      </form>
      <Feedback testid="backfill-feedback" error={m.isError ? writeError(m.error) : null} />
      {m.isSuccess && <BackfillResult r={m.data} />}
    </Card>
  )
}

function BackfillResult({ r }: { r: BackfillResponse }) {
  return (
    <div className="mt-3 space-y-2" data-testid="backfill-result">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={gradeTone(r.before_grade)}>{r.before_grade}</Badge>
        <span className="text-neutral-500">→</span>
        <Badge tone={gradeTone(r.after_grade)}>{r.after_grade}</Badge>
        <span className="text-neutral-500">preview — nothing committed</span>
      </div>
      {r.seeds.length === 0 ? (
        <p className="text-xs text-neutral-600">
          No seeds generated (a deterministic stub can’t author; a live model fills the gap).
        </p>
      ) : (
        <ul className="space-y-1">
          {r.seeds.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone="amber">{s.provenance}</Badge>
              <span className="text-neutral-300">{s.stakes}</span>
              <IdChip>{s.state}</IdChip>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProbeCard({ file }: { file: File | null }) {
  const m = useProbePack()
  const [tries, setTries] = useState('3')
  function run(e: FormEvent) {
    e.preventDefault()
    m.reset()
    if (file) m.mutate({ file, tries: Number(tries) || undefined })
  }
  return (
    <Card className="p-4">
      <form onSubmit={run} className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-200">Probe</h2>
        <span className="text-xs text-neutral-500">
          capability report · operator · LLM · warn-not-fail
        </span>
        <label className="ml-auto flex items-center gap-1 text-xs text-neutral-400">
          tries
          <input
            data-testid="probe-tries"
            value={tries}
            onChange={(e) => setTries(e.target.value)}
            className="w-12 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
          />
        </label>
        <Submit pending={m.isPending} disabled={!file} testid="probe-run">
          Probe
        </Submit>
      </form>
      <Feedback testid="probe-feedback" error={m.isError ? writeError(m.error) : null} />
      {m.isSuccess && <ProbeResultView r={m.data} />}
    </Card>
  )
}

function ProbeResultView({ r }: { r: ProbeResponse }) {
  return (
    <div className="mt-3 space-y-2" data-testid="probe-result">
      <div className="flex items-center gap-2">
        <Badge tone={r.ok ? 'green' : 'red'}>{r.ok ? 'ok' : 'not ok'}</Badge>
        <span className="text-xs text-neutral-500">{r.results.length} probe(s)</span>
      </div>
      <ul className="space-y-1">
        {r.results.map((p) => (
          <li key={p.name} className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={statusTone(p.status)}>{p.status}</Badge>
            <span className="w-32 text-neutral-300">{p.name}</span>
            <span className="text-neutral-500">{p.detail}</span>
          </li>
        ))}
      </ul>
      {r.warnings.length > 0 && (
        <div className="text-xs text-amber-300/80">warnings: {r.warnings.join(' · ')}</div>
      )}
    </div>
  )
}

export function AuthoringPage() {
  const [file, setFile] = useState<File | null>(null)

  function pick(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
  }

  return (
    <section data-testid="authoring-page">
      <PageHeading
        title="Pack Authoring"
        subtitle="Upload a world-pack .zip → validate, AI-backfill (operator), or probe the model (operator). No world is created here."
      />
      <Card className="mb-4 p-4">
        <label className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-neutral-400">Pack .zip</span>
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={pick}
            data-testid="pack-file"
            className="text-xs text-neutral-400 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-neutral-200"
          />
          {file && <IdChip>{file.name}</IdChip>}
        </label>
      </Card>

      <div className="grid gap-4">
        <ValidateCard file={file} />
        <BackfillCard file={file} />
        <ProbeCard file={file} />
      </div>
    </section>
  )
}
