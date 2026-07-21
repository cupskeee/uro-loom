import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useProviders } from '../api/queries'
import {
  useCreateConnection,
  useCreateCredential,
  useDeleteConnection,
  useDeleteCredential,
  useDeleteRoleBinding,
  useRefreshConnection,
  useReloadRouter,
  useSetConnectionEnabled,
  useSetRoleBinding,
  useTestConnection,
} from '../api/mutations'
import { codexPoll, codexStart } from '../api/endpoints'
import { errorMessage, isForbidden } from '../api/errors'
import type {
  CodexStartResponse,
  ModelConnection,
  ProvidersResponse,
  RoleBinding,
} from '../api/types'
import { useConnection } from '../config/connection'
import { QueryBoundary } from '../components/QueryBoundary'
import { Badge, Card, IdChip, PageHeading } from '../components/ui'
import { Feedback, Submit, TextField } from '../components/forms'

// The engine roles a connection can back (shared with the server's ROLES). `default` is the fallback.
const ROLES = ['default', 'narrator', 'extractor', 'planner', 'embedder', 'dialogue', 'judge']
const PROVIDER_KINDS = ['openai', 'anthropic', 'openai_compat', 'local', 'stub']

/** Map a 403 on any provider write to the operator-token hint (every /providers route is D-44). */
function writeError(err: unknown): string {
  if (isForbidden(err)) return 'Operator token required — reconnect with an --admin-token (D-44).'
  return errorMessage(err)
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  testid,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  testid?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <Field label={label}>
      <select
        data-testid={testid}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <Card className="p-4" data-testid="provider-section">
      <div className="mb-3">
        <div className="text-sm font-semibold text-neutral-200">{title}</div>
        {subtitle && <div className="text-xs text-neutral-500">{subtitle}</div>}
      </div>
      {children}
    </Card>
  )
}

function CredentialsSection({ data }: { data: ProvidersResponse }) {
  const add = useCreateCredential()
  const del = useDeleteCredential()
  const [provider, setProvider] = useState('openai')
  const [key, setKey] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    add.reset()
    add.mutate({ provider, access_token: key.trim() }, { onSuccess: () => setKey('') })
  }

  return (
    <Section
      title="Credentials"
      subtitle="An API key is stored ENCRYPTED at rest (the server needs URO_SECRET_KEY); it is never shown again."
    >
      <form onSubmit={submit} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr_auto]">
        <Select
          label="Provider"
          value={provider}
          onChange={setProvider}
          testid="cred-provider"
          options={PROVIDER_KINDS.map((p) => ({ value: p, label: p }))}
        />
        <TextField
          label="API key"
          value={key}
          onChange={setKey}
          required
          type="password"
          testid="cred-key"
          placeholder="sk-…"
        />
        <div className="flex items-end">
          <Submit pending={add.isPending} testid="cred-submit">
            Add credential
          </Submit>
        </div>
      </form>
      <Feedback
        testid="cred-feedback"
        error={add.isError ? writeError(add.error) : null}
        success={add.isSuccess ? <span>stored · {add.data.id}</span> : null}
      />
      {data.credentials.length === 0 ? (
        <div className="text-xs text-neutral-500">No credentials yet.</div>
      ) : (
        <ul className="space-y-1" data-testid="credential-list">
          {data.credentials.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <IdChip>{c.id}</IdChip>
              <span className="text-neutral-400">{c.provider}</span>
              <span className="text-xs text-neutral-600">{c.auth_mode}</span>
              {c.has_access_token && <Badge tone="green">key set</Badge>}
              <button
                onClick={() => del.mutate(c.id)}
                data-testid="credential-delete"
                className="ml-auto text-xs text-red-400 hover:text-red-300"
              >
                delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

/** The Codex (ChatGPT-subscription) OAuth device-login modal: shows the code to enter on OpenAI's
 *  page + an Authorize button, then polls until the login connects (D-47). Matches nano-abi's UX. */
function CodexLoginModal({ name, onClose }: { name: string; onClose: () => void }) {
  const { connection } = useConnection()
  const qc = useQueryClient()
  const [data, setData] = useState<CodexStartResponse | null>(null)
  const [phase, setPhase] = useState<'starting' | 'awaiting' | 'connected' | 'error'>('starting')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const cancelled = useRef(false)
  // Read onClose via a ref so the poll effect doesn't depend on it — the parent passes a fresh
  // arrow each render, which would otherwise re-anchor the poll deadline on every re-render (review).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Begin the login once on mount.
  useEffect(() => {
    if (!connection) return
    let alive = true
    codexStart(connection, name)
      .then((d) => alive && (setData(d), setPhase('awaiting')))
      .catch((e) => alive && (setError(errorMessage(e)), setPhase('error')))
    return () => {
      alive = false
    }
  }, [connection, name])

  // Poll while awaiting approval; a connect invalidates the providers snapshot and closes.
  useEffect(() => {
    if (phase !== 'awaiting' || !data || !connection) return
    cancelled.current = false
    const deadline = Date.now() + data.expires_in * 1000
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      if (cancelled.current) return
      try {
        const res = await codexPoll(connection, data.login_id)
        if (cancelled.current) return
        if (res.status === 'connected') {
          // Let the dedicated connected-effect below handle the auto-close — clearing this effect's
          // own `timer` on the phase change would cancel a close scheduled here (review [5]).
          qc.invalidateQueries({ queryKey: ['providers', connection.baseUrl] })
          setPhase('connected')
          return
        }
      } catch (e) {
        if (!cancelled.current) {
          setError(errorMessage(e))
          setPhase('error')
        }
        return
      }
      if (Date.now() > deadline) {
        setError('the code expired before you approved it — start again')
        setPhase('error')
        return
      }
      timer = setTimeout(tick, Math.max(1, data.interval) * 1000)
    }
    timer = setTimeout(tick, Math.max(1, data.interval) * 1000)
    return () => {
      cancelled.current = true
      clearTimeout(timer)
    }
  }, [phase, data, connection, qc])

  // Auto-close shortly after a successful connect — its OWN effect (so the poll effect's cleanup
  // can't cancel it) reading onClose via the ref (so a parent re-render can't re-arm it) (review).
  useEffect(() => {
    if (phase !== 'connected') return
    const t = setTimeout(() => onCloseRef.current(), 1000)
    return () => clearTimeout(t)
  }, [phase])

  function copy() {
    if (!data) return
    navigator.clipboard?.writeText(data.user_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      data-testid="codex-modal"
    >
      <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-neutral-950 p-6 shadow-xl">
        {phase === 'error' ? (
          <div className="space-y-4">
            <div className="text-sm text-red-300" data-testid="codex-error">
              {error}
            </div>
            <button
              onClick={onClose}
              className="text-sm text-neutral-300 hover:text-neutral-100"
              data-testid="codex-close"
            >
              Close
            </button>
          </div>
        ) : phase === 'connected' ? (
          <div className="space-y-2" data-testid="codex-connected">
            <div className="text-sm font-medium text-green-400">✓ Connected to ChatGPT (Codex)</div>
            <div className="text-xs text-neutral-500">
              The connection is ready — bind it to a role below.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-neutral-300">
              Enter this code on the OpenAI authorization page:
            </div>
            <div className="flex items-center gap-3">
              <span
                className="font-mono text-2xl tracking-widest text-neutral-100"
                data-testid="codex-user-code"
              >
                {data?.user_code ?? '········'}
              </span>
              <button
                onClick={copy}
                disabled={!data}
                data-testid="codex-copy"
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <a
              href={data?.verification_uri ?? '#'}
              target="_blank"
              rel="noreferrer"
              data-testid="codex-authorize"
              className={`block rounded-lg px-4 py-3 text-center text-sm font-semibold ${
                data
                  ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                  : 'pointer-events-none bg-neutral-800 text-neutral-500'
              }`}
            >
              Authorize with OpenAI ↗
            </a>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                {phase === 'starting'
                  ? 'Starting…'
                  : 'Authorize with OpenAI, then approve the code…'}
              </span>
              <button
                onClick={onClose}
                data-testid="codex-cancel"
                className="hover:text-neutral-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ConnectionsSection({ data }: { data: ProvidersResponse }) {
  const add = useCreateConnection()
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [authId, setAuthId] = useState('')
  const [codexOpen, setCodexOpen] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    add.reset()
    add.mutate(
      {
        name: name.trim(),
        provider,
        base_url: baseUrl.trim() || undefined,
        auth_id: authId || undefined,
      },
      { onSuccess: () => setName('') },
    )
  }

  return (
    <Section
      title="Connections"
      subtitle="A provider endpoint. Link a credential (or leave keyless for local/stub)."
    >
      <form onSubmit={submit} className="mb-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            required
            testid="conn-name"
            placeholder="my-openai"
          />
          <Select
            label="Provider"
            value={provider}
            onChange={setProvider}
            testid="conn-provider"
            options={PROVIDER_KINDS.map((p) => ({ value: p, label: p }))}
          />
          <TextField
            label="Base URL (optional — required for openai_compat)"
            value={baseUrl}
            onChange={setBaseUrl}
            testid="conn-baseurl"
            placeholder="https://…/v1"
          />
          <Select
            label="Credential (optional)"
            value={authId}
            onChange={setAuthId}
            testid="conn-cred"
            placeholder="— keyless —"
            options={data.credentials.map((c) => ({
              value: c.id,
              label: `${c.provider} · ${c.id}`,
            }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <Submit pending={add.isPending} testid="conn-submit">
            Add connection
          </Submit>
          <Feedback
            testid="conn-feedback"
            error={add.isError ? writeError(add.error) : null}
            success={add.isSuccess ? <span>added · {add.data.id}</span> : null}
          />
        </div>
      </form>
      <div className="mb-4 flex items-center gap-3 border-t border-neutral-800 pt-4">
        <div className="text-xs text-neutral-500">
          Or connect a <span className="text-neutral-300">ChatGPT subscription</span> (Codex) — no
          API key, via OpenAI sign-in.
        </div>
        <button
          onClick={() => setCodexOpen(true)}
          data-testid="codex-connect"
          className="ml-auto rounded-md border border-indigo-500/50 px-3 py-1.5 text-sm text-indigo-300 hover:bg-indigo-500/10"
        >
          Connect ChatGPT (Codex)
        </button>
      </div>
      {codexOpen && <CodexLoginModal name="ChatGPT (Codex)" onClose={() => setCodexOpen(false)} />}
      {data.connections.length === 0 ? (
        <div className="text-xs text-neutral-500">No connections yet.</div>
      ) : (
        <ul className="space-y-2" data-testid="connection-list">
          {data.connections.map((c) => (
            <ConnectionRow key={c.id} conn={c} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function ConnectionRow({ conn }: { conn: ModelConnection }) {
  const toggle = useSetConnectionEnabled()
  const del = useDeleteConnection()
  const refresh = useRefreshConnection()
  const test = useTestConnection()
  // The connection-level test is a LIVENESS check — send no model and let the server pick a
  // known-good canary. Do NOT send cached_models[0]: the discovered list is sorted, so OpenAI's
  // leads with `babbage-002`, a legacy model the chat-probe can't call (a false ✗). A precise
  // per-MODEL check lives on each role binding below.
  const btn = 'text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-50'
  return (
    <li
      className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 p-2 text-sm"
      data-testid="connection-row"
    >
      <span className="font-medium text-neutral-200">{conn.name}</span>
      <Badge tone="indigo">{conn.provider}</Badge>
      {conn.base_url && <span className="text-xs text-neutral-500">{conn.base_url}</span>}
      {conn.auth_id ? (
        <Badge tone="green">keyed</Badge>
      ) : (
        <span className="text-xs text-neutral-600">keyless</span>
      )}
      {!conn.is_enabled && <Badge tone="amber">disabled</Badge>}
      {conn.cached_models && (
        <span className="text-xs text-neutral-500" data-testid="conn-model-count">
          {conn.cached_models.length} models
        </span>
      )}
      <IdChip>{conn.id}</IdChip>
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={() => refresh.mutate(conn.id)}
          disabled={refresh.isPending}
          data-testid="conn-refresh"
          className={btn}
        >
          {refresh.isPending ? 'refreshing…' : 'refresh models'}
        </button>
        <button
          onClick={() => test.mutate({ id: conn.id })}
          disabled={test.isPending}
          data-testid="conn-test"
          className={btn}
        >
          {test.isPending ? 'testing…' : 'test'}
        </button>
        <button
          onClick={() => toggle.mutate({ id: conn.id, is_enabled: !conn.is_enabled })}
          data-testid="connection-toggle"
          className={btn}
        >
          {conn.is_enabled ? 'disable' : 'enable'}
        </button>
        <button
          onClick={() => del.mutate(conn.id)}
          data-testid="connection-delete"
          className="text-xs text-red-400 hover:text-red-300"
        >
          delete
        </button>
      </div>
      {(refresh.isError || refresh.isSuccess || test.isSuccess || test.isError) && (
        <div className="w-full text-xs" data-testid="conn-result">
          {refresh.isError && <span className="text-red-300">{writeError(refresh.error)}</span>}
          {refresh.isSuccess && (
            <span className="text-neutral-400">discovered {refresh.data.models.length} models</span>
          )}
          {test.isError && <span className="text-red-300">{writeError(test.error)}</span>}
          {test.isSuccess && (
            <span className={test.data.ok ? 'text-green-400' : 'text-red-300'}>
              {test.data.ok ? '✓ ' : '✗ '}
              {test.data.detail}
            </span>
          )}
        </div>
      )}
    </li>
  )
}

/** One engine-role row: its binding (or "unbound"), plus a live per-MODEL test + unbind. Each owns
 *  its own test mutation so a ✓/✗ shows only on the role you clicked (mirrors ConnectionRow). */
function RoleRow({ role, binding }: { role: string; binding: RoleBinding | undefined }) {
  const unbind = useDeleteRoleBinding()
  const test = useTestConnection()
  const btn = 'text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-50'
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm" data-testid="role-row">
      <span className="w-20 text-neutral-300">{role}</span>
      {binding ? (
        <>
          <span className="text-neutral-500">→</span>
          <IdChip>{binding.connection_id}</IdChip>
          <span className="text-neutral-400">{binding.model}</span>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => test.mutate({ id: binding.connection_id, model: binding.model })}
              disabled={test.isPending}
              data-testid="role-test"
              className={btn}
            >
              {test.isPending ? 'testing…' : 'test'}
            </button>
            <button
              onClick={() => unbind.mutate(role)}
              data-testid="role-unbind"
              className="text-xs text-red-400 hover:text-red-300"
            >
              unbind
            </button>
          </div>
          {(test.isSuccess || test.isError) && (
            <div className="w-full text-xs" data-testid="role-test-result">
              {test.isError && <span className="text-red-300">{writeError(test.error)}</span>}
              {test.isSuccess && (
                <span className={test.data.ok ? 'text-green-400' : 'text-red-300'}>
                  {test.data.ok ? '✓ ' : '✗ '}
                  {test.data.detail}
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <span className="text-xs text-neutral-600">— unbound (falls back to default) —</span>
      )}
    </li>
  )
}

function RolesSection({ data }: { data: ProvidersResponse }) {
  const bind = useSetRoleBinding()
  const [role, setRole] = useState('default')
  const [connectionId, setConnectionId] = useState('')
  const [model, setModel] = useState('')
  const bound = new Map(data.roles.map((b) => [b.role, b]))
  const selectedConn = data.connections.find((c) => c.id === connectionId)
  const models = selectedConn?.cached_models // populated by "refresh models" → a picker

  function submit(e: FormEvent) {
    e.preventDefault()
    bind.reset()
    bind.mutate({ role, body: { connection_id: connectionId, model: model.trim() } })
  }

  return (
    <Section
      title="Role bindings"
      subtitle="Which connection + model backs each engine role. `default` is the fallback for any unbound role."
    >
      <form
        onSubmit={submit}
        className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr_1fr_auto]"
      >
        <Select
          label="Role"
          value={role}
          onChange={setRole}
          testid="role-name"
          options={ROLES.map((r) => ({ value: r, label: r }))}
        />
        <Select
          label="Connection"
          value={connectionId}
          onChange={(v) => {
            setConnectionId(v)
            setModel('') // a stale model from another connection shouldn't carry over
          }}
          testid="role-connection"
          placeholder="— pick a connection —"
          options={data.connections.map((c) => ({
            value: c.id,
            label: `${c.name} (${c.provider})`,
          }))}
        />
        {models && models.length > 0 ? (
          <Select
            label="Model"
            value={model}
            onChange={setModel}
            testid="role-model"
            placeholder="— pick a model —"
            required
            options={models.map((m) => ({ value: m.id, label: `${m.id} · ${m.modality}` }))}
          />
        ) : (
          <TextField
            label="Model"
            value={model}
            onChange={setModel}
            required
            testid="role-model"
            placeholder="gpt-4o (refresh the connection for a picker)"
          />
        )}
        <div className="flex items-end">
          <Submit pending={bind.isPending} testid="role-submit">
            Bind
          </Submit>
        </div>
      </form>
      <Feedback
        testid="role-feedback"
        error={bind.isError ? writeError(bind.error) : null}
        success={bind.isSuccess ? <span>bound {bind.data.role}</span> : null}
      />
      <ul className="space-y-1" data-testid="role-list">
        {ROLES.map((r) => (
          <RoleRow key={r} role={r} binding={bound.get(r)} />
        ))}
      </ul>
    </Section>
  )
}

function ReloadButton() {
  const reload = useReloadRouter()
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => {
          reload.reset()
          reload.mutate()
        }}
        disabled={reload.isPending}
        data-testid="reload-router"
        className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
      >
        {reload.isPending ? 'reloading…' : 'Reload router'}
      </button>
      {reload.isSuccess && (
        <span className="text-xs text-neutral-400" data-testid="reload-result">
          {reload.data.reloaded ? 'router rebound from the registry' : (reload.data.detail ?? '')}
        </span>
      )}
      {reload.isError && <span className="text-xs text-red-300">{writeError(reload.error)}</span>}
    </div>
  )
}

export function ProvidersPage() {
  const query = useProviders()
  return (
    <section data-testid="providers-page" className="space-y-6">
      <PageHeading
        title="Providers"
        subtitle="Configure the LLM provider registry for this uro instance (D-47). Operator-only; keys are encrypted at rest. At `uro serve` startup the router is built from these bindings, else the --provider/uro.toml seed."
        actions={<ReloadButton />}
      />
      <QueryBoundary query={query}>
        {(data: ProvidersResponse) => (
          <>
            <CredentialsSection data={data} />
            <ConnectionsSection data={data} />
            <RolesSection data={data} />
          </>
        )}
      </QueryBoundary>
    </section>
  )
}
