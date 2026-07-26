import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Gift, Trophy } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { Button } from '@/components/ui/Button'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import type {
  EventScan,
  RevokedRewardPreview,
  RewardTransfer,
  ScanDeletionPreview,
  ScanDeletionResult,
} from '@/hooks/useEventScans'
import { formatTimeOfDay, getIsraelHour, getIsraelMinute } from '@/lib/israelTime'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

/**
 * Deleting a scan is never just "minus 15 points" - it can take a prize off
 * someone, and for a reward only the first winner may hold, it decides who ends
 * up with it instead. So the dialog asks the database what the delete would do,
 * lays it out, and lets the operator choose per reward before anything is
 * written. It closes on a summary of how each prize actually ended.
 */

interface DeleteScanDialogProps {
  scan: EventScan | null
  participantName: string
  onPreview: (scanId: string) => Promise<{ ok: true; preview: ScanDeletionPreview } | { ok: false; error: string }>
  onDelete: (
    scanId: string,
    transfers: RewardTransfer[],
  ) => Promise<{ ok: true; result: ScanDeletionResult } | { ok: false; error: string }>
  onClose: () => void
  /** Fired once the delete went through, so the list around it can catch up. */
  onDeleted?: () => void
}

/** 'transfer' hands the prize on; 'keep' leaves it with no winner. */
type Choice = 'transfer' | 'keep'

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return formatTimeOfDay(getIsraelHour(date), getIsraelMinute(date))
}

function points(n: number): string {
  return n.toLocaleString('he-IL')
}

/**
 * A participant's name inside a sentence. Rendered as its own token because
 * Hebrew glues the preposition onto the name ("לרון לוי") - without a visual
 * break it is genuinely unclear where the sentence ends and the person begins.
 */
function PersonName({ children }: { children: string }) {
  return (
    <span
      className={cn(
        'mx-1 inline-block rounded-md px-1.5 py-px align-baseline',
        'bg-primary/10 ring-1 ring-inset ring-primary/20',
        'text-[0.95em] font-bold text-primary-text',
      )}
    >
      {children}
    </span>
  )
}

/** One reward that the delete knocks out, and what should happen to it. */
function RewardDecision({
  reward,
  choice,
  onChoice,
}: {
  reward: RevokedRewardPreview
  choice: Choice
  onChoice: (choice: Choice) => void
}) {
  const isFirstOnly = reward.winnerMode === 'first'

  return (
    <div className={cn('rounded-xl border p-3', theme.border, theme.bgCardMuted)}>
      <div className="flex items-start gap-2">
        <Gift size={16} className="mt-0.5 shrink-0 text-warning-text" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={cn('font-semibold', theme.text)}>{reward.rewardName}</p>
          <p className={cn('mt-0.5 text-xs', theme.textMuted)}>
            נדרשות {points(reward.requiredPoints)} נק' · {isFirstOnly ? 'רק הראשון זוכה' : 'פתוח לכל מי שמגיע ליעד'}
          </p>
        </div>
      </div>

      {!isFirstOnly ? (
        <p className={cn('mt-2 text-xs leading-relaxed', theme.textMuted)}>
          הפרס יבוטל, ויוענק שוב אוטומטית ברגע שהניקוד יחזור מעל היעד.
        </p>
      ) : reward.nextWinner ? (
        <div className="mt-2.5 space-y-1.5" role="radiogroup" aria-label={`מה לעשות עם הפרס ${reward.rewardName}`}>
          <label className={cn('flex cursor-pointer items-start gap-2 rounded-lg p-2', theme.hoverSurface)}>
            <input
              type="radio"
              name={`reward-${reward.rewardId}`}
              checked={choice === 'transfer'}
              onChange={() => onChoice('transfer')}
              className="mt-1 shrink-0 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className={cn('flex items-baseline gap-1.5 text-sm font-semibold', theme.text)}>
                <Trophy size={13} aria-hidden="true" className="shrink-0 translate-y-0.5 text-warning-text" />
                <span>
                  העברת הפרס אל <PersonName>{reward.nextWinner.name}</PersonName>
                </span>
              </span>
              <span className={cn('mt-0.5 block text-xs leading-relaxed', theme.textMuted)}>
                הבא בתור: היעד נחצה ב-{formatTime(reward.nextWinner.crossedAt)} · {points(reward.nextWinner.totalPoints)}{' '}
                נק' כרגע.
              </span>
            </span>
          </label>

          <label className={cn('flex cursor-pointer items-start gap-2 rounded-lg p-2', theme.hoverSurface)}>
            <input
              type="radio"
              name={`reward-${reward.rewardId}`}
              checked={choice === 'keep'}
              onChange={() => onChoice('keep')}
              className="mt-1 shrink-0 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-sm font-semibold', theme.text)}>להשאיר את הפרס ללא זוכה</span>
              <span className={cn('mt-0.5 block text-xs leading-relaxed', theme.textMuted)}>
                הפרס ייפתח מחדש, ויילך למי שיחצה את היעד בסריקה הבאה - לאו דווקא
                <PersonName>{reward.nextWinner.name}</PersonName>
              </span>
            </span>
          </label>
        </div>
      ) : (
        <p className={cn('mt-2 text-xs leading-relaxed', theme.textMuted)}>
          אין כרגע משתתף אחר מעל היעד, אז אין למי להעביר. הפרס ייפתח מחדש ויילך למי שיחצה את היעד בסריקה הבאה.
        </p>
      )}
    </div>
  )
}

export function DeleteScanDialog({
  scan,
  participantName,
  onPreview,
  onDelete,
  onClose,
  onDeleted,
}: DeleteScanDialogProps) {
  const [preview, setPreview] = useState<ScanDeletionPreview | null>(null)
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [result, setResult] = useState<ScanDeletionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scanId = scan?.id ?? null

  useEffect(() => {
    if (!scanId) {
      setPreview(null)
      setResult(null)
      setError(null)
      setChoices({})
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    onPreview(scanId).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setPreview(res.preview)
        // Transferring is the default: leaving a "first winner" prize open hands
        // it to whoever scans next, which is the outcome nobody chose.
        setChoices(
          Object.fromEntries(
            res.preview.revoked
              .filter((reward) => reward.winnerMode === 'first' && reward.nextWinner)
              .map((reward) => [reward.rewardId, 'transfer' as Choice]),
          ),
        )
      } else {
        setError(res.error)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [scanId, onPreview])

  const confirm = useCallback(async () => {
    if (!scanId || !preview) return
    setWorking(true)
    setError(null)

    const transfers: RewardTransfer[] = preview.revoked
      .filter((reward) => reward.nextWinner && choices[reward.rewardId] === 'transfer')
      .map((reward) => ({ rewardId: reward.rewardId, participantId: reward.nextWinner!.participantId }))

    const res = await onDelete(scanId, transfers)
    setWorking(false)

    if (!res.ok) {
      setError(res.error)
      return
    }

    onDeleted?.()
    // A delete with no prize consequences needs no report - close on the spot.
    if (res.result.revoked.length === 0) onClose()
    else setResult(res.result)
  }, [scanId, preview, choices, onDelete, onDeleted, onClose])

  const revoked = preview?.revoked ?? []

  return (
    <Modal
      isOpen={scan !== null}
      onClose={onClose}
      title={result ? 'הסריקה נמחקה' : 'מחיקת סריקה'}
      dialogClassName="max-w-lg"
    >
      {loading ? (
        <CenteredLoader />
      ) : result ? (
        <div className="space-y-4">
          <p className={cn('text-sm leading-relaxed', theme.textMuted)}>
            הניקוד של <PersonName>{participantName}</PersonName> עודכן ל-
            <span className={cn('font-bold', theme.text)}>{points(result.newTotal)} נק'</span>. כך נסגר כל פרס
            שהושפע:
          </p>

          <ul className="space-y-2">
            {result.revoked.map((reward) => (
              <li
                key={reward.rewardId}
                className={cn('rounded-xl border p-3', theme.border, theme.bgCardMuted)}
              >
                <p className={cn('flex items-center gap-1.5 font-semibold', theme.text)}>
                  <Gift size={15} className="shrink-0 text-warning-text" aria-hidden="true" />
                  {reward.rewardName}
                </p>
                <p className={cn('mt-1 flex items-center gap-1.5 text-sm', theme.textMuted)}>
                  <ArrowLeft size={13} className="shrink-0" aria-hidden="true" />
                  {reward.transferredTo ? (
                    <span>
                      הזכייה עברה אל <PersonName>{reward.transferredTo.name}</PersonName>
                    </span>
                  ) : reward.winnerMode === 'first' ? (
                    'הפרס פתוח שוב - יזכה בו מי שיחצה את היעד בסריקה הבאה'
                  ) : (
                    <span>
                      הפרס בוטל עבור <PersonName>{participantName}</PersonName> ויוענק שוב כשהניקוד יחזור מעל
                      היעד
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>

          <ModalActions className="pt-0">
            <Button onClick={onClose}>סגירה</Button>
          </ModalActions>
        </div>
      ) : (
        <div className="space-y-4">
          {error && <ErrorAlert message={error} />}

          {preview && (
            <>
              <div className={cn('rounded-xl border p-3', theme.border)}>
                <p className={cn('text-sm leading-relaxed', theme.textMuted)}>
                  הסריקה <span className={cn('font-semibold', theme.text)}>{preview.actionName}</span> של{' '}
                  <PersonName>{preview.participantName}</PersonName> תימחק, והיא שווה{' '}
                  <span className={cn('font-semibold', theme.text)}>{points(preview.deletedPoints)} נק'</span>.
                </p>

                {/* Two labelled cells rather than "60 ← 20": in an RTL sentence
                    an arrow between two bare numbers reads either way round. */}
                <div className="mt-3 flex items-center gap-2">
                  <div className={cn('flex-1 rounded-lg border px-2 py-1.5 text-center', theme.border)}>
                    <p className={cn('text-[11px] font-medium', theme.textMuted)}>הניקוד עכשיו</p>
                    <p className={cn('text-lg font-black tabular-nums', theme.text)}>
                      {points(preview.currentTotal)} <span className="text-xs font-bold">נק'</span>
                    </p>
                  </div>
                  <ArrowLeft size={16} className={cn('shrink-0', theme.textMuted)} aria-hidden="true" />
                  <div className="flex-1 rounded-lg border border-danger/30 bg-danger/5 px-2 py-1.5 text-center">
                    <p className="text-[11px] font-medium text-danger-text">אחרי המחיקה</p>
                    <p className="text-lg font-black tabular-nums text-danger-text">
                      {points(preview.newTotal)} <span className="text-xs font-bold">נק'</span>
                    </p>
                  </div>
                </div>
              </div>

              {revoked.length === 0 ? (
                <p className={cn('text-sm', theme.textMuted)}>אף פרס לא מושפע מהמחיקה הזו.</p>
              ) : (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-danger-text">
                    <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
                    {revoked.length === 1
                      ? 'המחיקה מורידה פרס אחד:'
                      : `המחיקה מורידה ${revoked.length} פרסים:`}
                  </p>
                  {revoked.map((reward) => (
                    <RewardDecision
                      key={reward.rewardId}
                      reward={reward}
                      choice={choices[reward.rewardId] ?? 'keep'}
                      onChoice={(choice) =>
                        setChoices((prev) => ({ ...prev, [reward.rewardId]: choice }))
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <ModalActions className="pt-0">
            <Button variant="danger" loading={working} disabled={!preview} onClick={confirm}>
              {revoked.length > 0 ? 'מחיקה ועדכון הפרסים' : 'מחיקת הסריקה'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              ביטול
            </Button>
          </ModalActions>
        </div>
      )}
    </Modal>
  )
}
