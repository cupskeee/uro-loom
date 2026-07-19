import { useParams } from 'react-router-dom'
import { useChronicle } from '../../api/queries'
import { QueryBoundary } from '../../components/QueryBoundary'
import { Card, IdChip } from '../../components/ui'

export function ChroniclePanel() {
  const { campaignId = '' } = useParams()
  const query = useChronicle(campaignId)

  return (
    <QueryBoundary
      query={query}
      isEmpty={(c) => c.beats.length === 0}
      empty="No beats yet — this campaign hasn't been played."
    >
      {({ beats }) => (
        <div className="space-y-3" data-testid="chronicle-panel">
          {/* beats arrive oldest-first (chat-reconstruction order) */}
          {beats.map((b) => (
            <Card key={b.beat_id} className="p-4">
              {b.intent_text && (
                <div className="mb-2 text-sm text-neutral-400">
                  <span className="text-neutral-600">intent · </span>
                  {b.intent_text}
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                {b.narration}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                <IdChip>{b.beat_id}</IdChip>
                <span>·</span>
                <span>{b.participant_id}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </QueryBoundary>
  )
}
