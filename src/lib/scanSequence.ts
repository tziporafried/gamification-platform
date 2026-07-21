import { parseQrPayload } from '@/lib/qrPayload'
import { looksLikeHebrewLayoutScan } from '@/lib/keyboardLayout'

/**
 * How long a scanned participant card stays "armed" waiting for its action
 * card. Past this the sequence drops and the screen returns to idle, so an
 * abandoned half-scan never pairs with whoever walks up next.
 */
export const SPLIT_SCAN_TIMEOUT_MS = 30_000

export const SCAN_SEQUENCE_MESSAGES = {
  actionBeforeParticipant: 'סרקתם כרטיס משימה בלבד - יש לסרוק קודם את כרטיס המשתתף.',
  hebrewKeyboardLayout: 'המקלדת במצב עברית - החליפו לאנגלית (Alt+Shift) וסרקו שוב.',
} as const

/** A participant card waiting on its action card. */
export interface PendingParticipant {
  participantCode: string
  /** Epoch ms after which the sequence is abandoned. */
  expiresAt: number
}

export type ScanOutcome =
  /** Both codes known - score it. */
  | { kind: 'pair'; participantCode: string; actionCode: string; pending: null }
  /** Participant card accepted; waiting on the action card. */
  | { kind: 'armed'; pending: PendingParticipant }
  /** Nothing to do but tell the operator. `pending` is returned unchanged. */
  | { kind: 'error'; message: string; pending: PendingParticipant | null }

/** Drops an armed participant once its window has closed. */
export function expirePending(
  pending: PendingParticipant | null,
  now: number,
): PendingParticipant | null {
  if (!pending) return null
  return now < pending.expiresAt ? pending : null
}

/**
 * The whole rulebook for a raw scanner read.
 *
 * A combined card scores on its own. Otherwise the order is fixed: the
 * participant card arms the sequence and the action card completes it. An
 * action scanned on its own is refused rather than armed, so the operator is
 * told immediately instead of discovering the problem 30 seconds later.
 *
 * The event's configured scan mode deliberately plays no part here - it decides
 * which cards get printed, not what the scanner is willing to read, so a deck
 * printed either way (or a mix of both) always works.
 *
 * Pure, so the ordering and expiry rules can be exercised directly; the hook
 * around it owns only React state and the countdown tick.
 */
export function resolveScan({
  raw,
  pending,
  now,
}: {
  raw: string
  pending: PendingParticipant | null
  now: number
}): ScanOutcome {
  // A card scanned right as the window closes is judged against the window it
  // was aimed at, so expiry is applied before anything else.
  const live = expirePending(pending, now)

  const parsed = parseQrPayload(raw)
  if (!parsed.ok) {
    // A Hebrew keyboard layout scrambles the scanned JSON into Hebrew letters, so
    // the "invalid barcode" that results is really an input-mode problem - name it
    // so the operator switches to English instead of blaming the card.
    const message = looksLikeHebrewLayoutScan(raw)
      ? SCAN_SEQUENCE_MESSAGES.hebrewKeyboardLayout
      : parsed.error
    // An unreadable read is a misfire, not an intent to cancel - the armed
    // participant stays armed so the operator can just rescan the action card.
    return { kind: 'error', message, pending: live }
  }

  const code = parsed.data

  switch (code.kind) {
    // Self-sufficient; supersedes anything half-scanned rather than merging.
    case 'combined':
      return {
        kind: 'pair',
        participantCode: code.participantCode,
        actionCode: code.actionCode,
        pending: null,
      }

    // Rescanning a participant re-arms from scratch rather than erroring -
    // that is how an operator corrects picking up the wrong card.
    case 'participant':
      return {
        kind: 'armed',
        pending: { participantCode: code.participantCode, expiresAt: now + SPLIT_SCAN_TIMEOUT_MS },
      }

    case 'action':
      if (!live) {
        return { kind: 'error', message: SCAN_SEQUENCE_MESSAGES.actionBeforeParticipant, pending: null }
      }
      return {
        kind: 'pair',
        participantCode: live.participantCode,
        actionCode: code.actionCode,
        pending: null,
      }
  }
}
