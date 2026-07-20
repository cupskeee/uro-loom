import { type FormEvent, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCodex } from '../../api/queries'
import { useAddCodexNote } from '../../api/mutations'
import { errorMessage, isForbidden } from '../../api/errors'
import type { CodexResponse, ParticipantNote } from '../../api/types'
import { QueryBoundary } from '../../components/QueryBoundary'
import { Badge, Card, IdChip } from '../../components/ui'
import { Feedback, Submit, TextField } from '../../components/forms'

function scopeError(err: unknown): string {
  if (isForbidden(err)) return 'You can only read/write your own codex (or as an operator, D-39).'
  return errorMessage(err)
}

function NoteRow({ n }: { n: ParticipantNote }) {
  return (
    <li className="py-2" data-testid="note-row">
      <div className="flex flex-wrap items-center gap-2">
        {n.pinned && <Badge tone="indigo">pinned</Badge>}
        {n.entity_refs.map((r) => (
          <IdChip key={r}>{r}</IdChip>
        ))}
        <span className="text-[10px] text-neutral-700">{n.key}</span>
      </div>
      <div className="mt-1 text-sm text-neutral-300">{n.text}</div>
    </li>
  )
}

function AddNoteForm({ campaignId, participant }: { campaignId: string; participant: string }) {
  const m = useAddCodexNote(campaignId)
  const [text, setText] = useState('')
  const [pinned, setPinned] = useState(false)
  const [refs, setRefs] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    m.reset()
    const parsedRefs = refs
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
    m.mutate(
      {
        text: text.trim(),
        participant: participant || undefined,
        pinned,
        refs: parsedRefs.length ? parsedRefs : undefined,
      },
      { onSuccess: () => setText('') },
    )
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="space-y-3" data-testid="add-note-form">
        <label className="block space-y-1">
          <span className="text-xs text-neutral-400">
            A note that survives a fork (never canon)
          </span>
          <textarea
            data-testid="note-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={2}
            placeholder="The vault code is 7-3-9 — remember it across the loop."
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <input
              type="checkbox"
              data-testid="note-pinned"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            pinned (always surfaces)
          </label>
          <div className="min-w-[10rem] flex-1">
            <TextField
              label="Entity refs (comma-separated, optional)"
              value={refs}
              onChange={setRefs}
              testid="note-refs"
              placeholder="name:vault, a:hero"
            />
          </div>
          <Submit pending={m.isPending} testid="note-submit">
            Add note
          </Submit>
        </div>
        <Feedback
          testid="note-feedback"
          error={m.isError ? scopeError(m.error) : null}
          success={m.isSuccess ? <span>saved · {m.data.key}</span> : null}
        />
      </form>
    </Card>
  )
}

export function CodexPanel() {
  const { campaignId = '' } = useParams()
  // Empty = the caller's own codex (the server defaults `participant` to the token's identity).
  // An operator may inspect another participant's by entering their id.
  const [viewing, setViewing] = useState('')
  const query = useCodex(campaignId, viewing || undefined)

  return (
    <div data-testid="codex-panel" className="space-y-4">
      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
          <div className="min-w-[12rem] flex-1">
            <TextField
              label="Viewing participant (blank = your own; operator to view others, D-39)"
              value={viewing}
              onChange={setViewing}
              testid="codex-participant"
              placeholder="player-2"
            />
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">
          Codex{' '}
          <span className="text-neutral-500">· out-of-world notes (fork-surviving, D-36)</span>
        </h2>
        <QueryBoundary
          query={query}
          isEmpty={(d: CodexResponse) => d.notes.length === 0}
          empty="No notes yet — add one below."
        >
          {(d) => (
            <ol className="divide-y divide-neutral-900">
              {d.notes.map((n) => (
                <NoteRow key={n.key} n={n} />
              ))}
            </ol>
          )}
        </QueryBoundary>
      </Card>

      <AddNoteForm campaignId={campaignId} participant={viewing} />
    </div>
  )
}
