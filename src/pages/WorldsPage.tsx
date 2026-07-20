import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorlds } from '../api/queries'
import { useCreateWorld } from '../api/mutations'
import { errorMessage } from '../api/errors'
import { QueryBoundary } from '../components/QueryBoundary'
import { Card, IdChip, PageHeading } from '../components/ui'
import { Feedback, Submit, TextField } from '../components/forms'

function NewWorldForm({ onClose }: { onClose: () => void }) {
  const m = useCreateWorld()
  const [name, setName] = useState('')
  const [tone, setTone] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    m.reset()
    m.mutate({ name: name.trim(), tone: tone.trim() || undefined })
  }

  return (
    <Card className="mb-4 p-4">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            required
            testid="world-name"
            placeholder="Ashfall"
          />
          <TextField
            label="Tone (optional)"
            value={tone}
            onChange={setTone}
            placeholder="grim, folkloric"
          />
        </div>
        <div className="flex items-center gap-3">
          <Submit pending={m.isPending} testid="world-create-submit">
            Create world
          </Submit>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-neutral-400 hover:text-neutral-200"
          >
            cancel
          </button>
          <Feedback
            testid="world-create-feedback"
            error={m.isError ? errorMessage(m.error) : null}
            success={
              m.isSuccess ? (
                <span>
                  created <IdChip>{m.data.world_id}</IdChip> ·{' '}
                  <Link
                    to={`/campaigns?world=${encodeURIComponent(m.data.world_id)}`}
                    className="text-indigo-300 hover:text-indigo-200"
                  >
                    new campaign →
                  </Link>
                </span>
              ) : null
            }
          />
        </div>
      </form>
    </Card>
  )
}

export function WorldsPage() {
  const query = useWorlds()
  const [creating, setCreating] = useState(false)

  return (
    <section data-testid="worlds-page">
      <PageHeading
        title="Worlds"
        subtitle="Every world this server knows about."
        actions={
          <button
            data-testid="new-world"
            onClick={() => setCreating((v) => !v)}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            {creating ? 'Close' : '+ New world'}
          </button>
        }
      />

      {creating && <NewWorldForm onClose={() => setCreating(false)} />}

      <QueryBoundary
        query={query}
        isEmpty={(worlds) => worlds.length === 0}
        empty="No worlds yet. Create one above, or with `uro world new` / a pack import."
      >
        {(worlds) => (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {worlds.map((w) => (
              <li key={w.world_id}>
                <Link
                  to={`/worlds/${encodeURIComponent(w.world_id)}`}
                  className="block h-full"
                  data-testid="world-card"
                >
                  <Card className="h-full p-4 transition hover:border-neutral-600">
                    <div className="font-medium">{w.name}</div>
                    <div className="mt-1">
                      <IdChip>{w.world_id}</IdChip>
                    </div>
                    <div className="mt-2 text-xs text-neutral-600">
                      main branch <IdChip>{w.main_branch_id}</IdChip>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </section>
  )
}
