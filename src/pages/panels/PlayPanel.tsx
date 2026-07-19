import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePlaySession } from '../../play/usePlaySession'
import type { LogEntry } from '../../play/playSession'
import { Badge, Card } from '../../components/ui'

function closeMessage(code: number | null, reason: string): string {
  switch (code) {
    case 4401:
      return 'Unauthorized — the token was rejected. Reconnect with a valid token.'
    case 4403:
      return 'This token is not valid for this campaign (it was minted for another).'
    case 4404:
      return 'No such campaign on this server.'
    default:
      return reason ? `Disconnected: ${reason}` : 'Disconnected.'
  }
}

function StatusBanner({
  status,
  code,
  reason,
}: {
  status: string
  code: number | null
  reason: string
}) {
  if (status === 'open') return null
  const text =
    status === 'connecting'
      ? 'Connecting to the play channel…'
      : status === 'error'
        ? 'Connection error — is the server reachable and running?'
        : closeMessage(code, reason)
  const tone = status === 'connecting' ? 'amber' : 'red'
  return (
    <div
      className={`mb-3 rounded-md border px-3 py-2 text-sm ${
        tone === 'amber'
          ? 'border-amber-900/60 bg-amber-950/30 text-amber-300'
          : 'border-red-900/60 bg-red-950/30 text-red-300'
      }`}
      data-testid="play-status"
    >
      {text}
    </div>
  )
}

function Entry({ entry }: { entry: LogEntry }) {
  if (entry.kind === 'talk') {
    return (
      <div className="flex justify-end" data-testid="talk-entry">
        <div className="max-w-[80%] rounded-lg border border-indigo-900/50 bg-indigo-950/30 px-3 py-2 text-sm text-indigo-200">
          <div className="mb-0.5 text-[10px] uppercase tracking-wide text-indigo-400/80">
            table-talk · non-canon · {entry.participant}
          </div>
          {entry.text}
        </div>
      </div>
    )
  }
  if (entry.kind === 'notice') {
    const color =
      entry.level === 'warn'
        ? 'text-amber-400'
        : entry.level === 'error'
          ? 'text-red-400'
          : 'text-neutral-500'
    return <div className={`py-1 text-center text-xs ${color}`}>{entry.text}</div>
  }
  // beat
  return (
    <Card className="p-3" data-testid="beat-entry">
      {entry.intent && (
        <div className="mb-1 text-xs text-neutral-500">
          <span className="text-neutral-600">intent · </span>
          {entry.intent}
        </div>
      )}
      {entry.status === 'failed' ? (
        <div className="text-sm text-red-300">beat failed — {entry.error}</div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
          {entry.narration}
          {entry.status === 'streaming' && (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-neutral-500 align-text-bottom" />
          )}
        </p>
      )}
    </Card>
  )
}

export function PlayPanel() {
  const { campaignId = '' } = useParams()
  const { state, send } = usePlaySession(campaignId)
  const [intent, setIntent] = useState('')
  const [talk, setTalk] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.entries.length])

  const connected = state.status === 'open'

  function submitIntent(e: FormEvent) {
    e.preventDefault()
    const text = intent.trim()
    if (!text || !connected) return
    send({ type: 'intent', text })
    setIntent('')
  }

  function submitTalk(e: FormEvent) {
    e.preventDefault()
    const text = talk.trim()
    if (!text || !connected) return
    send({ type: 'table_talk', text })
    setTalk('')
  }

  function intentKeydown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitIntent(e)
    }
  }

  return (
    <div data-testid="play-panel">
      <StatusBanner status={state.status} code={state.closeCode} reason={state.closeReason} />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <span>
          {connected ? 'live' : state.status} · {state.roster.length} connected
        </span>
        {state.roster.map((p) => (
          <Badge key={p} tone="neutral">
            {p}
          </Badge>
        ))}
        <span className="text-neutral-700">
          · turn order is server-driven; scene/mode aren’t streamed by the server (docs/02)
        </span>
      </div>

      <Card
        className="mb-3 max-h-[55vh] min-h-[16rem] overflow-y-auto p-3"
        data-testid="play-transcript"
      >
        {state.entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-600">
            {connected ? 'Send an intent to take the first beat.' : 'Waiting for the play channel…'}
          </div>
        ) : (
          <div className="space-y-2">
            {state.entries.map((e) => (
              <Entry key={e.id} entry={e} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </Card>

      <form onSubmit={submitIntent} className="mb-2">
        <div className="flex gap-2">
          <textarea
            data-testid="intent-input"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={intentKeydown}
            rows={2}
            disabled={!connected}
            placeholder={
              connected
                ? 'Describe your action… (Enter to send, Shift+Enter for a newline)'
                : 'Not connected'
            }
            className="flex-1 resize-none rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
          />
          <button
            data-testid="intent-send"
            type="submit"
            disabled={!connected}
            className="rounded-md bg-indigo-600 px-4 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            Act
          </button>
        </div>
      </form>

      <form onSubmit={submitTalk} className="flex gap-2">
        <input
          data-testid="talk-input"
          value={talk}
          onChange={(e) => setTalk(e.target.value)}
          disabled={!connected}
          placeholder="Table-talk (out-of-world, non-canon — never a beat)"
          className="flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-indigo-200 outline-none focus:border-indigo-800 disabled:opacity-50"
        />
        <button
          data-testid="talk-send"
          type="submit"
          disabled={!connected}
          className="rounded-md border border-indigo-900 px-3 text-sm text-indigo-300 hover:bg-indigo-950/40 disabled:opacity-50"
        >
          Say
        </button>
      </form>
    </div>
  )
}
