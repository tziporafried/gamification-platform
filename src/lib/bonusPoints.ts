/**
 * What makes a bonus award valid, decided in one place.
 *
 * The popup on the scan screen needs it to know when to enable its button, and
 * useBonusAward needs it again before it writes - a disabled button is a hint,
 * not a guarantee, and the database's own CHECK (092) is a last line rather
 * than an error anyone should ever see.
 *
 * Nothing here touches the network, which is what lets the rules be tested on
 * their own.
 */

/**
 * The most one bonus can be worth.
 *
 * Not a product rule so much as a guard against a slipped keystroke: an
 * operator typing on a kiosk who means 50 and hits 500000 has just decided the
 * game, and point_transactions is append-only - undoing it means a trip to the
 * management screen. High enough to be out of the way of any real award.
 */
export const BONUS_MAX_POINTS = 10_000

/** Long enough to say what happened, short enough to fit the activity feed. */
export const BONUS_REASON_MAX_LENGTH = 60

export interface BonusDraft {
  participantId: string | null
  reason: string
  /** As typed. Digit-by-digit entry means it is a string until it is checked. */
  points: string
}

export type BonusValidationError =
  | 'NO_PARTICIPANT'
  | 'NO_REASON'
  | 'NO_POINTS'
  | 'POINTS_NOT_WHOLE'
  | 'POINTS_TOO_HIGH'

export type BonusValidation =
  | { ok: true; participantId: string; reason: string; points: number }
  | { ok: false; error: BonusValidationError }

const MESSAGES: Record<BonusValidationError, string> = {
  NO_PARTICIPANT: 'בחרו משתתף',
  NO_REASON: 'כתבו על מה הבונוס',
  NO_POINTS: 'הזינו כמה נקודות',
  POINTS_NOT_WHOLE: 'הניקוד חייב להיות מספר שלם וחיובי',
  POINTS_TOO_HIGH: `הניקוד המרבי לבונוס הוא ${BONUS_MAX_POINTS.toLocaleString('he-IL')}`,
}

export function bonusErrorMessage(error: BonusValidationError): string {
  return MESSAGES[error]
}

/**
 * Only digits, capped at the length the maximum needs.
 *
 * Same shape as the task limit field (TaskLimitSelect): the input is filtered
 * as it is typed rather than validated after it, so a kiosk keypad cannot put
 * a minus sign or a decimal point in a points box at all.
 */
export function sanitizeBonusPoints(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, String(BONUS_MAX_POINTS).length)
}

export function validateBonus(draft: BonusDraft): BonusValidation {
  if (!draft.participantId) return { ok: false, error: 'NO_PARTICIPANT' }

  const reason = draft.reason.trim()
  if (!reason) return { ok: false, error: 'NO_REASON' }

  const raw = draft.points.trim()
  if (!raw) return { ok: false, error: 'NO_POINTS' }

  const points = Number(raw)
  if (!Number.isInteger(points) || points <= 0) return { ok: false, error: 'POINTS_NOT_WHOLE' }
  if (points > BONUS_MAX_POINTS) return { ok: false, error: 'POINTS_TOO_HIGH' }

  return {
    ok: true,
    participantId: draft.participantId,
    reason: reason.slice(0, BONUS_REASON_MAX_LENGTH),
    points,
  }
}
