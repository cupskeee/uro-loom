import { type FormEvent, useState } from 'react'
import { useConnection } from '../config/connection'

const DEFAULT_URL = import.meta.env.VITE_DEFAULT_SERVER_URL ?? 'http://127.0.0.1:8000'

export function ConnectionScreen() {
  const { connect } = useConnection()
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL)
  const [token, setToken] = useState('')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = baseUrl.trim()
    if (!trimmed) return
    connect({ baseUrl: trimmed, token: token.trim() || null })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-5 rounded-xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Uro Loom</h1>
          <p className="text-sm text-neutral-400">
            Connect to a running <code className="text-neutral-300">uro serve</code> instance.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-neutral-300">Server URL</span>
          <input
            data-testid="server-url"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://127.0.0.1:8000"
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-neutral-300">
            Bearer token{' '}
            <span className="text-neutral-500">(optional for a local no-auth server)</span>
          </span>
          <input
            data-testid="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="a --token / minted credential"
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            autoComplete="off"
          />
        </label>

        <button
          data-testid="connect"
          type="submit"
          className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          Connect
        </button>

        <p className="text-xs text-neutral-500">
          The token is kept in this tab only (sessionStorage) and never committed. See LD-4.
        </p>
      </form>
    </div>
  )
}
