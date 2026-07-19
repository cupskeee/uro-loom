import { type FormEvent, type ReactNode, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useJoinCampaign,
  useMintToken,
  useReportOutcome,
  useRevokeToken,
  useTimeSkip,
} from '../../api/mutations'
import { buildOutcomeBundle } from '../../api/outcome'
import { errorMessage } from '../../api/errors'
import { Card, IdChip } from '../../components/ui'
import { Feedback, Submit, TextField } from '../../components/forms'

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
    <Card className="p-4">
      <div className="mb-3">
        <div className="text-sm font-medium text-neutral-200">{title}</div>
        {subtitle && <div className="text-xs text-neutral-500">{subtitle}</div>}
      </div>
      {children}
    </Card>
  )
}

function JoinForm({ campaignId }: { campaignId: string }) {
  const m = useJoinCampaign(campaignId)
  const [participant, setParticipant] = useState('')
  const [pcName, setPcName] = useState('')
  const [adopt, setAdopt] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    m.reset()
    m.mutate({
      participant: participant.trim(),
      new_pc_name: pcName.trim() || undefined,
      adopt_actor_id: adopt.trim() || undefined,
    })
  }

  return (
    <Section title="Join" subtitle="Seat a participant on a PC (new or adopted).">
      <form onSubmit={submit} className="space-y-3">
        <TextField
          label="Participant"
          value={participant}
          onChange={setParticipant}
          required
          testid="join-participant"
          placeholder="player-2"
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="New PC name"
            value={pcName}
            onChange={setPcName}
            placeholder="Wren"
            testid="join-pc"
          />
          <TextField
            label="…or adopt actor id"
            value={adopt}
            onChange={setAdopt}
            placeholder="actor_…"
          />
        </div>
        <div className="flex items-center gap-3">
          <Submit pending={m.isPending} testid="join-submit">
            Join
          </Submit>
          <Feedback
            testid="join-feedback"
            error={m.isError ? errorMessage(m.error) : null}
            success={
              m.isSuccess ? (
                <span>
                  bound <IdChip>{m.data.actor_id}</IdChip>
                  {m.data.token && (
                    <>
                      {' '}
                      · token <IdChip>{m.data.token}</IdChip>
                    </>
                  )}
                </span>
              ) : null
            }
          />
        </div>
      </form>
    </Section>
  )
}

function MintForm({ campaignId }: { campaignId: string }) {
  const m = useMintToken(campaignId)
  const [participant, setParticipant] = useState('')
  return (
    <Section
      title="Mint token"
      subtitle="Issue a durable, campaign-scoped token for a seated participant."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          m.reset()
          m.mutate({ participant: participant.trim() })
        }}
        className="space-y-3"
      >
        <TextField
          label="Participant"
          value={participant}
          onChange={setParticipant}
          required
          testid="mint-participant"
          placeholder="player-2"
        />
        <div className="flex items-center gap-3">
          <Submit pending={m.isPending} testid="mint-submit">
            Mint
          </Submit>
          <Feedback
            testid="mint-feedback"
            error={m.isError ? errorMessage(m.error) : null}
            success={
              m.isSuccess ? (
                <span>
                  token <IdChip>{m.data.token}</IdChip>
                </span>
              ) : null
            }
          />
        </div>
      </form>
    </Section>
  )
}

function RevokeForm({ campaignId }: { campaignId: string }) {
  const m = useRevokeToken(campaignId)
  const [token, setToken] = useState('')
  return (
    <Section title="Revoke token">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          m.reset()
          m.mutate({ token: token.trim() })
        }}
        className="space-y-3"
      >
        <TextField
          label="Token"
          value={token}
          onChange={setToken}
          required
          type="password"
          placeholder="the token to revoke"
        />
        <div className="flex items-center gap-3">
          <Submit pending={m.isPending}>Revoke</Submit>
          <Feedback
            error={m.isError ? errorMessage(m.error) : null}
            success={
              m.isSuccess ? <span>{m.data.revoked ? 'revoked' : 'no such token'}</span> : null
            }
          />
        </div>
      </form>
    </Section>
  )
}

function TimeSkipForm({ campaignId }: { campaignId: string }) {
  const m = useTimeSkip(campaignId)
  const [days, setDays] = useState('7')
  return (
    <Section title="Time-skip" subtitle="Advance in-fiction time and fire downtime agenda rules.">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          m.reset()
          m.mutate({ days: Number(days) })
        }}
        className="space-y-3"
      >
        <TextField
          label="Days"
          value={days}
          onChange={setDays}
          type="number"
          required
          testid="timeskip-days"
        />
        <div className="flex items-center gap-3">
          <Submit pending={m.isPending} testid="timeskip-submit">
            Skip
          </Submit>
          <Feedback
            testid="timeskip-feedback"
            error={m.isError ? errorMessage(m.error) : null}
            success={m.isSuccess ? <span>done · {JSON.stringify(m.data)}</span> : null}
          />
        </div>
      </form>
    </Section>
  )
}

function OutcomeForm({ campaignId }: { campaignId: string }) {
  const m = useReportOutcome(campaignId)
  const [encounterId, setEncounterId] = useState('')
  const [participants, setParticipants] = useState('')
  const [witnesses, setWitnesses] = useState('')
  const [casualties, setCasualties] = useState('')
  const [featActor, setFeatActor] = useState('')
  const [featDescription, setFeatDescription] = useState('')
  const [durationRounds, setDurationRounds] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    m.reset()
    const bundle = buildOutcomeBundle({
      participants,
      witnesses,
      casualties,
      featActor,
      featDescription,
      durationRounds,
    })
    m.mutate({ encounterId: encounterId.trim(), bundle })
  }

  return (
    <Section
      title="Submit external outcome (Chronicler)"
      subtitle="Report an OutcomeBundle for an external encounter. Feats become witness rumors; the bundle can't mint protected canon (D-32)."
    >
      <form onSubmit={submit} className="space-y-3">
        <TextField
          label="Encounter id"
          value={encounterId}
          onChange={setEncounterId}
          required
          testid="outcome-encounter"
          placeholder="enc-001"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="Participants (csv)"
            value={participants}
            onChange={setParticipants}
            placeholder="actor_a, actor_b"
            testid="outcome-participants"
          />
          <TextField
            label="Witnesses (csv)"
            value={witnesses}
            onChange={setWitnesses}
            placeholder="actor_a"
          />
          <TextField
            label="Casualties (csv)"
            value={casualties}
            onChange={setCasualties}
            placeholder="actor_b"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Feat — actor"
            value={featActor}
            onChange={setFeatActor}
            placeholder="actor_a"
          />
          <TextField
            label="Feat — description"
            value={featDescription}
            onChange={setFeatDescription}
            placeholder="split the champion in two"
          />
        </div>
        <TextField
          label="Duration (rounds)"
          value={durationRounds}
          onChange={setDurationRounds}
          type="number"
          placeholder="3"
        />
        <div className="flex items-center gap-3">
          <Submit pending={m.isPending} testid="outcome-submit">
            Submit outcome
          </Submit>
          <Feedback
            testid="outcome-feedback"
            error={m.isError ? errorMessage(m.error) : null}
            success={m.isSuccess ? <span>recorded · {JSON.stringify(m.data)}</span> : null}
          />
        </div>
      </form>
    </Section>
  )
}

export function ManagePanel() {
  const { campaignId = '' } = useParams()
  return (
    <div className="grid gap-4" data-testid="manage-panel">
      <JoinForm campaignId={campaignId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <MintForm campaignId={campaignId} />
        <RevokeForm campaignId={campaignId} />
      </div>
      <TimeSkipForm campaignId={campaignId} />
      <OutcomeForm campaignId={campaignId} />
    </div>
  )
}
