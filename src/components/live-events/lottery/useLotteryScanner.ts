import { useCallback, useEffect, useRef, useState } from 'react'
import { useScoreSubmit } from '@/hooks/useScoreSubmit'
import { useScanSequence, type PendingParticipant } from '@/hooks/useScanSequence'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import { trackScanFailed, trackScanSuccess } from '@/lib/analytics'
import { recordScanLotteryEntry } from './scanLotteryRounds'

/**
 * Scanning from inside the lottery screen, while a scan round is collecting.
 *
 * This is the kiosk's scan path, composed differently - not a second one. The
 * three pieces it stands on are the same ones the kiosk stands on:
 *
 *   useScoreSubmit      all the scoring rules (limits, windows, groups, trial
 *                       cap, rewards). Nothing about scoring is re-decided here.
 *   useScanSequence     combined card scores at once; participant card arms and
 *                       waits for its task card. Same rulebook, same timeout.
 *   useHardwareScanner  the wedge-scanner keyboard binding and its refocus.
 *
 * What differs is what happens afterwards. The kiosk runs a celebration
 * takeover; here the scan also claims a lottery ticket - one per participant
 * per round, so scanning again is answered with "you already have one" rather
 * than a second entry.
 *
 * That claim is written here, and only here. It is what keeps the lottery
 * separate from the game's other scanning stations: those scans score points
 * exactly as before and never touch the pool, because a ticket is earned at
 * the lottery rather than counted out of the scan log afterwards.
 */

/** How long the last scan's result stays on the stage. */
const FEEDBACK_MS = 2_600

export type LotteryScanFeedback =
  /** First scan of the round for this person - they now hold a ticket. */
  | { kind: 'scored'; participantName: string; actionName: string }
  /** They already had one. The scan still scored; the hat is unchanged. */
  | { kind: 'duplicate'; participantName: string }
  | { kind: 'error'; message: string }

export interface LotteryScannerState {
  /** Ref callback for the hidden input the wedge scanner types into. */
  bind: (input: HTMLInputElement | null) => void
  /** A participant card is armed, waiting on its task card (split decks). */
  pending: PendingParticipant | null
  remainingSeconds: number
  waitProgress: number
  /** The last scan's outcome, cleared on its own after a beat. */
  feedback: LotteryScanFeedback | null
  submitting: boolean
}

interface UseLotteryScannerOptions {
  eventId: string
  /** The open round a ticket would belong to. null when nothing is collecting. */
  roundId: string | null
  /** Collecting, on a plan that may scan, in a game that has started. */
  enabled: boolean
  /** A ticket was added - recount the pool without waiting for the poll. */
  onScored: () => void
}

export function useLotteryScanner({
  eventId,
  roundId,
  enabled,
  onScored,
}: UseLotteryScannerOptions): LotteryScannerState {
  const { submit, submitting } = useScoreSubmit(eventId)
  const [feedback, setFeedback] = useState<LotteryScanFeedback | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>()
  const onScoredRef = useRef(onScored)
  onScoredRef.current = onScored

  const show = useCallback((next: LotteryScanFeedback) => {
    clearTimeout(feedbackTimer.current)
    setFeedback(next)
    feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS)
  }, [])

  const handlePair = useCallback(
    async (participantCode: string, actionCode: string) => {
      const response = await submit(participantCode, actionCode)
      if (!response.ok) {
        // The trial cap is a wall, not a mistake the operator can fix by
        // rescanning, so it is named rather than echoed as a raw error.
        if (response.code === 'TRIAL_SCAN_LIMIT_REACHED') {
          trackScanFailed('trial_scan_limit', 'qr_scan')
          show({ kind: 'error', message: 'נגמרו סריקות הניסיון - שדרגו כדי להמשיך.' })
          return
        }
        trackScanFailed('submit_failed', 'qr_scan')
        show({ kind: 'error', message: response.error })
        return
      }
      trackScanSuccess('qr_scan')

      // The scan scored; now claim the ticket it earned. This write is the
      // only thing that puts anybody in the lottery - which is exactly why
      // scans taken at the game's other stations never join the pool.
      if (!roundId) return
      try {
        const { isNewTicket } = await recordScanLotteryEntry({
          roundId,
          participantId: response.result.participantId,
          transactionId: response.result.transactionId,
        })
        if (!isNewTicket) {
          show({ kind: 'duplicate', participantName: response.result.participantName })
          return
        }
      } catch {
        // The points landed but the ticket did not. Say so plainly rather than
        // celebrate a ticket they do not hold.
        show({ kind: 'error', message: 'הסריקה נקלטה אך הכרטיס לא נרשם. נסו שוב.' })
        return
      }

      show({
        kind: 'scored',
        participantName: response.result.participantName,
        actionName: response.result.actionName,
      })
      // The counter should not lag behind the hand of the person standing here.
      onScoredRef.current()
    },
    [submit, show, roundId],
  )

  const handleScanError = useCallback(
    (message: string) => {
      trackScanFailed('invalid_qr', 'qr_scan')
      show({ kind: 'error', message })
    },
    [show],
  )

  const { handleScan, pending, remainingSeconds, waitProgress, reset } = useScanSequence({
    onPair: handlePair,
    onError: handleScanError,
  })

  // Closing the round (or leaving the mode) abandons a half-finished sequence:
  // an armed participant must not survive to pair with a later task scan.
  useEffect(() => {
    if (!enabled) {
      reset()
      setFeedback(null)
      clearTimeout(feedbackTimer.current)
    }
  }, [enabled, reset])

  useEffect(() => () => clearTimeout(feedbackTimer.current), [])

  const bind = useHardwareScanner(enabled && !submitting, handleScan)

  return { bind, pending, remainingSeconds, waitProgress, feedback, submitting }
}
