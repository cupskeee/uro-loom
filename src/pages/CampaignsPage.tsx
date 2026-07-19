import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCampaigns, useWorlds } from '../api/queries'
import { useCreateCampaign } from '../api/mutations'
import { errorMessage } from '../api/errors'
import { QueryBoundary } from '../components/QueryBoundary'
import { Badge, Card, IdChip, PageHeading } from '../components/ui'
import { Feedback, Submit, TextField } from '../components/forms'

function NewCampaignForm({ presetWorldId }: { presetWorldId?: string }) {
  const worlds = useWorlds()
  const [worldId, setWorldId] = useState(presetWorldId ?? '')
  const effectiveWorldId = presetWorldId ?? worldId
  const m = useCreateCampaign(effectiveWorldId)
  const [participant, setParticipant] = useState('player-1')
  const [pcName, setPcName] = useState('')
  const [seed, setSeed] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!effectiveWorldId) return
    m.reset()
    m.mutate({
      participant: participant.trim(),
      new_pc_name: pcName.trim() || undefined,
      seed: seed.trim() ? Number(seed) : undefined,
    })
  }

  return (
    <Card className="mb-4 p-4">
      <form onSubmit={submit} className="space-y-3">
        {!presetWorldId && (
          <label className="block space-y-1">
            <span className="text-xs text-neutral-400">World</span>
            <select
              data-testid="campaign-world"
              value={worldId}
              onChange={(e) => setWorldId(e.target.value)}
              required
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">Select a world…</option>
              {(worlds.data ?? []).map((w) => (
                <option key={w.world_id} value={w.world_id}>
                  {w.name} ({w.world_id})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="Participant"
            value={participant}
            onChange={setParticipant}
            required
            testid="campaign-participant"
          />
          <TextField
            label="New PC name (optional)"
            value={pcName}
            onChange={setPcName}
            placeholder="Adventurer"
          />
          <TextField
            label="Seed (optional)"
            value={seed}
            onChange={setSeed}
            type="number"
            placeholder="0"
          />
        </div>
        <div className="flex items-center gap-3">
          <Submit
            pending={m.isPending}
            disabled={!effectiveWorldId}
            testid="campaign-create-submit"
          >
            Create campaign
          </Submit>
          <Feedback
            testid="campaign-create-feedback"
            error={m.isError ? errorMessage(m.error) : null}
            success={
              m.isSuccess ? (
                <span>
                  created{' '}
                  <Link
                    to={`/campaigns/${encodeURIComponent(m.data.campaign_id)}`}
                    className="text-indigo-300 hover:text-indigo-200"
                  >
                    {m.data.campaign_id} →
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

export function CampaignsPage() {
  const [params] = useSearchParams()
  const worldId = params.get('world') ?? undefined
  const query = useCampaigns(worldId)
  const [creating, setCreating] = useState(false)

  return (
    <section data-testid="campaigns-page">
      <PageHeading
        title="Campaigns"
        subtitle={worldId ? undefined : 'Every play-through on this server.'}
        actions={
          <div className="flex items-center gap-3">
            {worldId && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-neutral-500">world</span>
                <Badge tone="indigo">{worldId}</Badge>
                <Link to="/campaigns" className="text-xs text-neutral-400 hover:text-neutral-200">
                  clear
                </Link>
              </div>
            )}
            <button
              data-testid="new-campaign"
              onClick={() => setCreating((v) => !v)}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              {creating ? 'Close' : '+ New campaign'}
            </button>
          </div>
        }
      />

      {creating && <NewCampaignForm presetWorldId={worldId} />}

      <QueryBoundary
        query={query}
        isEmpty={(campaigns) => campaigns.length === 0}
        empty={
          worldId
            ? 'No campaigns in this world yet.'
            : 'No campaigns yet. Start one above or with `uro campaign new`.'
        }
      >
        {(campaigns) => (
          <Card>
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-800 text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Campaign</th>
                  <th className="px-4 py-2 font-medium">World</th>
                  <th className="px-4 py-2 font-medium">Ruleset</th>
                  <th className="px-4 py-2 font-medium">Seed</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.campaign_id}
                    className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/60"
                  >
                    <td className="px-4 py-2">
                      <Link
                        to={`/campaigns/${encodeURIComponent(c.campaign_id)}`}
                        className="text-indigo-300 hover:text-indigo-200"
                        data-testid="campaign-row"
                      >
                        {c.campaign_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <IdChip>{c.world_id}</IdChip>
                    </td>
                    <td className="px-4 py-2 text-neutral-300">
                      {c.ruleset_id ? (
                        <>
                          {c.ruleset_id}
                          {c.ruleset_version && (
                            <span className="text-neutral-600"> @{c.ruleset_version}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-neutral-600">registry default</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-neutral-400">{c.seed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </QueryBoundary>
    </section>
  )
}
