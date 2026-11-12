import { BONUS_MAX_POINTS, BONUS_REASON_MAX_LENGTH } from '@/lib/bonusPoints'

/**
 * The rules of a flash challenge that do not depend on React or the network:
 * what the setup form offers, and how a completion becomes a bonus row.
 */

/** Long enough for "צלמו סלפי קבוצתי", short enough to read across a hall. */
export const FLASH_TITLE_MAX_LENGTH = 60

/** The segmented control on the setup stage, in seconds. */
export const FLASH_DURATIONS = [60, 120, 180, 300] as const

export const FLASH_DEFAULT_DURATION = 120
export const FLASH_DEFAULT_POINTS = 50

/** "+30 שניות" in the operator's corner. */
export const FLASH_EXTEND_SECONDS = 30

/** 1st / 2nd / 3rd, on top of the challenge's points, when "בונוס לזריזים" is on. */
export const FLASH_DEFAULT_PODIUM_BONUS = [30, 20, 10] as const

const REASON_PREFIX = '⚡ אתגר בזק: '

/**
 * The bonus_reason a completion is recorded under, cut to what the column and
 * the activity feed allow. The prefix is kept whole: it is what tells the log
 * and the leaderboard this row came from a challenge and not a hand-given bonus.
 */
export function flashBonusReason(title: string): string {
  return (REASON_PREFIX + title.trim()).slice(0, BONUS_REASON_MAX_LENGTH)
}

/** Points for the next completer: the base, plus the podium bonus if they land on it. */
export function pointsForRank(points: number, podiumBonus: readonly number[] | undefined, rankIndex: number): number {
  return Math.min(points + (podiumBonus?.[rankIndex] ?? 0), BONUS_MAX_POINTS)
}

export interface FlashDraftInput {
  title: string
  durationSec: number
  points: string
}

export type FlashDraftError = 'NO_TITLE' | 'NO_POINTS' | 'POINTS_TOO_HIGH' | 'BAD_DURATION'

export function validateFlashDraft(
  draft: FlashDraftInput,
): { ok: true; title: string; durationSec: number; points: number } | { ok: false; error: FlashDraftError } {
  const title = draft.title.trim().slice(0, FLASH_TITLE_MAX_LENGTH)
  if (!title) return { ok: false, error: 'NO_TITLE' }
  if (!Number.isInteger(draft.durationSec) || draft.durationSec <= 0) return { ok: false, error: 'BAD_DURATION' }
  const points = Number(draft.points.trim())
  if (!draft.points.trim() || !Number.isInteger(points) || points <= 0) return { ok: false, error: 'NO_POINTS' }
  if (points > BONUS_MAX_POINTS) return { ok: false, error: 'POINTS_TOO_HIGH' }
  return { ok: true, title, durationSec: draft.durationSec, points }
}

/** "1:05", for the countdown and the setup's duration chips. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
