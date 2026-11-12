import { useCallback, useEffect, useRef, useState } from 'react'
import { useBonusAward } from '@/hooks/useBonusAward'
import { trackScanFailed, trackScanSuccess } from '@/lib/analytics'
import { findParticipantByCode } from '@/lib/participantByCode'
import { playScanSuccess } from '@/lib/scanSuccessSound'
import { flashBonusReason, pointsForRank } from '@/lib/flashChallenge/flashChallenge'
import { resolveChallengeScan, taskCardOnlyMessage } from '@/lib/flashChallenge/resolveChallengeScan'
import {
  addFlashCompletion,
  hasCompleted,
  loadFlashChallenge,
  statusOf,
  type FlashChallenge,
} from './flashChallengeStore'

/**
 * Scanning while a flash challenge runs on the scan screen.
 *
 * One scan, one completion. The card is read only to find out who is standing
 * at the station (resolveChallengeScan); its task half, on a combined deck, is
 * ignored - not scored and not marked done - so the card is still good for its
 * task later in the game. The points go in as a bonus row through
 * useBonusAward, the same path the "נקודות בונוס" popup uses, which already
 * re-totals, checks prizes and texts the participant.
 *
 * Deliberately not useScanSequence: that exists to pair a participant card with
 * a task card and would leave the operator waiting for a second scan. And not
 * useScoreSubmit: there is no task to score.
 */

/** How long the last scan's result stays on the stage. */
const FEEDBACK_MS = 2_600

export type FlashScanFeedback =
  | { kind: 'completed'; participantName: string; points: number; rank: number }
  | { kind: 'duplicate'; participantName: string }
  | { kind: 'task_card_only'; message: string }
  | { kind: 'unknown_card' }
  | { kind: 'closed' }
  | { kind: 'error'; message: string }

export interface FlashScannerState {
  /** Feed one raw read from the wedge scanner. The host owns the binding. */
  handleScan: (raw: string) => void
  /** Complete the challenge for a participant picked by hand. */
  handleManual: (participant: { id: string; name: string }) => Promise<void>
  feedback: FlashScanFeedback | null
  /** Bumps with every scan result, so the same message twice still re-animates. */
  feedbackId: number
  /** A card is being looked up or awarded - the scanner is paused meanwhile. */
  busy: boolean
}

interface UseFlashChallengeScannerOptions {
  eventId: string
  challenge: FlashChallenge | null
  /** Event scan_mode, for the task-card message. */
  scanMode: string | null
  /** A completion was recorded - the screen re-reads the challenge. */
  onCompleted: (next: FlashChallenge) => void
}

export function useFlashChallengeScanner({
  eventId,
  challenge,
  scanMode,
  onCompleted,
}: UseFlashChallengeScannerOptions): FlashScannerState {
  const { award } = useBonusAward(eventId)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<FlashScanFeedback | null>(null)
  const [feedbackId, setFeedbackId] = useState(0)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>()
  const onCompletedRef = useRef(onCompleted)
  onCompletedRef.current = onCompleted
  const challengeId = challenge?.id ?? null

  const show = useCallback((next: FlashScanFeedback) => {
    clearTimeout(feedbackTimer.current)
    setFeedback(next)
    setFeedbackId((n) => n + 1)
    feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS)
  }, [])

  /** The challenge as it stands, if a card read at `readAt` may still join it. */
  const openChallenge = useCallback((readAt: number): FlashChallenge | null => {
    // Read from storage rather than from props: the list must be the latest
    // one, or two quick scans would both be told they are first.
    const current = loadFlashChallenge(eventId)
    if (!current || !challengeId || current.id !== challengeId || statusOf(current, readAt) !== 'open') {
      show({ kind: 'closed' })
      return null
    }
    return current
  }, [eventId, challengeId, show])

  /**
   * Awards one known participant - the shared tail of a scan and of a manual
   * pick: the dedupe, the bonus row, the completion, the celebration.
   */
  const complete = useCallback(
    async (
      current: FlashChallenge,
      participant: { id: string; name: string },
      readAt: number,
      source: 'qr_scan' | 'manual_entry',
    ) => {
      // Checked before awarding, so a second scan costs nothing.
      if (hasCompleted(current, participant.id)) {
        show({ kind: 'duplicate', participantName: participant.name })
        return
      }

      const points = pointsForRank(current.points, current.podiumBonus, current.completions.length)
      const response = await award({
        participantId: participant.id,
        reason: flashBonusReason(current.title),
        points: String(points),
      })

      if (!response.ok) {
        if (response.code === 'TRIAL_SCAN_LIMIT_REACHED') {
          trackScanFailed('trial_scan_limit', source)
          show({ kind: 'error', message: 'נגמרו סריקות הניסיון - שדרגו כדי להמשיך.' })
          return
        }
        trackScanFailed('submit_failed', source)
        // The card is up for a few seconds; the console keeps the reason.
        console.warn('[flash] award failed:', response.error)
        show({ kind: 'error', message: response.error })
        return
      }

      const added = addFlashCompletion(
        eventId,
        current.id,
        {
          participantId: participant.id,
          name: response.result.participantName,
          points,
          transactionId: response.result.transactionId,
        },
        readAt,
      )
      // Only reachable if the challenge was thrown away mid-award ("אתגר
      // חדש"): the points are saved and stand on the log; there is just no
      // challenge left to list them under.
      if (!added.added) return

      trackScanSuccess(source)
      playScanSuccess()
      show({
        kind: 'completed',
        participantName: response.result.participantName,
        points,
        rank: added.rank,
      })
      onCompletedRef.current(added.challenge)
    },
    [eventId, award, show],
  )

  const handleScan = useCallback(
    async (raw: string) => {
      // The moment the card was read is what decides whether it was in time,
      // not the moment the award comes back.
      const readAt = Date.now()
      const current = openChallenge(readAt)
      if (!current) return

      const resolved = resolveChallengeScan(raw)
      if (!resolved.ok) {
        trackScanFailed('invalid_qr', 'qr_scan')
        if (resolved.reason === 'TASK_CARD_ONLY') {
          show({ kind: 'task_card_only', message: taskCardOnlyMessage(scanMode) })
        } else {
          show({ kind: 'unknown_card' })
        }
        return
      }

      setBusy(true)
      try {
        const { data: participant, error } = await findParticipantByCode(eventId, resolved.participantCode)
        if (error) {
          show({ kind: 'error', message: error.message })
          return
        }
        if (!participant) {
          trackScanFailed('invalid_qr', 'qr_scan')
          show({ kind: 'unknown_card' })
          return
        }
        await complete(current, participant, readAt, 'qr_scan')
      } finally {
        setBusy(false)
      }
    },
    [eventId, scanMode, openChallenge, complete, show],
  )

  /**
   * The scan screen's manual fallback: the operator picks the participant from
   * the roster instead of reading a card. Everything after "who" is the same.
   */
  const handleManual = useCallback(
    async (participant: { id: string; name: string }) => {
      const readAt = Date.now()
      const current = openChallenge(readAt)
      if (!current) return
      setBusy(true)
      try {
        await complete(current, participant, readAt, 'manual_entry')
      } finally {
        setBusy(false)
      }
    },
    [openChallenge, complete],
  )

  useEffect(() => () => clearTimeout(feedbackTimer.current), [])

  const handleRaw = useCallback((raw: string) => void handleScan(raw), [handleScan])

  return { handleScan: handleRaw, handleManual, feedback, feedbackId, busy }
}
