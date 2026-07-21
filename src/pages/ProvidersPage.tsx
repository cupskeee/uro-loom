import { type FormEvent, type ReactNode, useState } from 'react'
import { useProviders } from '../api/queries'
import {
  useCreateConnection,
  useCreateCredential,
  useDeleteConnection,
  useDeleteCredential,
  useDeleteRoleBinding,
  useSetConnectionEnabled,
  useSetRoleBinding,
} from '../api/mutations'
import { errorMessage, isForbidden } from '../api/errors'
import type { ProvidersResponse } from '../api/types'
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  testid?: string
  placeholder?: string
}) {
  return (
    <Field label={label}>
      <select
        data-testid={testid}
        value={value}
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

function ConnectionsSection({ data }: { data: ProvidersResponse }) {
  const add = useCreateConnection()
  const toggle = useSetConnectionEnabled()
  const del = useDeleteConnection()
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [authId, setAuthId] = useState('')

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
      {data.connections.length === 0 ? (
        <div className="text-xs text-neutral-500">No connections yet.</div>
      ) : (
        <ul className="space-y-2" data-testid="connection-list">
          {data.connections.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 p-2 text-sm"
              data-testid="connection-row"
            >
              <span className="font-medium text-neutral-200">{c.name}</span>
              <Badge tone="indigo">{c.provider}</Badge>
              {c.base_url && <span className="text-xs text-neutral-500">{c.base_url}</span>}
              {c.auth_id ? (
                <Badge tone="green">keyed</Badge>
              ) : (
                <span className="text-xs text-neutral-600">keyless</span>
              )}
              {!c.is_enabled && <Badge tone="amber">disabled</Badge>}
              <IdChip>{c.id}</IdChip>
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={() => toggle.mutate({ id: c.id, is_enabled: !c.is_enabled })}
                  data-testid="connection-toggle"
                  className="text-xs text-neutral-400 hover:text-neutral-200"
                >
                  {c.is_enabled ? 'disable' : 'enable'}
                </button>
                <button
                  onClick={() => del.mutate(c.id)}
                  data-testid="connection-delete"
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function RolesSection({ data }: { data: ProvidersResponse }) {
  const bind = useSetRoleBinding()
  const unbind = useDeleteRoleBinding()
  const [role, setRole] = useState('default')
  const [connectionId, setConnectionId] = useState('')
  const [model, setModel] = useState('')
  const bound = new Map(data.roles.map((b) => [b.role, b]))

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
          onChange={setConnectionId}
          testid="role-connection"
          placeholder="— pick a connection —"
          options={data.connections.map((c) => ({
            value: c.id,
            label: `${c.name} (${c.provider})`,
          }))}
        />
        <TextField
          label="Model"
          value={model}
          onChange={setModel}
          required
          testid="role-model"
          placeholder="gpt-4o"
        />
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
        {ROLES.map((r) => {
          const b = bound.get(r)
          return (
            <li key={r} className="flex items-center gap-2 text-sm" data-testid="role-row">
              <span className="w-20 text-neutral-300">{r}</span>
              {b ? (
                <>
                  <span className="text-neutral-500">→</span>
                  <IdChip>{b.connection_id}</IdChip>
                  <span className="text-neutral-400">{b.model}</span>
                  <button
                    onClick={() => unbind.mutate(r)}
                    data-testid="role-unbind"
                    className="ml-auto text-xs text-red-400 hover:text-red-300"
                  >
                    unbind
                  </button>
                </>
              ) : (
                <span className="text-xs text-neutral-600">
                  — unbound (falls back to default) —
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

export function ProvidersPage() {
  const query = useProviders()
  return (
    <section data-testid="providers-page" className="space-y-6">
      <PageHeading
        title="Providers"
        subtitle="Configure the LLM provider registry for this uro instance (D-47). Operator-only; keys are encrypted at rest. At `uro serve` startup the router is built from these bindings, else the --provider/uro.toml seed."
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
