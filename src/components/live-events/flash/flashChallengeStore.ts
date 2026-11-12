/**
 * The running flash challenge, in the browser.
 *
 * Modelled on the scan lottery's collection (lottery/scanLotteryStore): one
 * screen is both projected and scanned into, so one browser writes and the same
 * browser reads. No table, no realtime channel, no cross-device state. The
 * points themselves are real bonus rows in point_transactions; what lives here
 * is only the challenge around them - its title, its clock, and who finished
 * in what order.
 *
 * Status is derived, never stored: a challenge is open while it has no closedAt
 * and its clock has not run out. That is what lets a reload mid-challenge land
 * back on the same countdown (computed from startedAt) and a reload after the
 * end land on the summary instead of a reopened challenge.
 *
 * Everything here is synchronous, for the same reason the lottery's store is.
 */

export interface FlashCompletion {
  participantId: string
  name: string
  points: number
  /** ISO - when the card was read, not when the award came back. */
  at: string
  transactionId: string
}

export interface FlashChallenge {
  id: string
  eventId: string
  title: string
  durationSec: number
  points: number
  /** Extra points for 1st/2nd/3rd, when "בונוס לזריזים" was on. */
  podiumBonus?: number[]
  /** ISO. */
  startedAt: string
  /** ISO - set on timeout or manual close. */
  closedAt: string | null
  completions: FlashCompletion[]
}

export type FlashChallengeStatus = 'open' | 'closed'

export interface FlashChallengeDraft {
  title: string
  durationSec: number
  points: number
  podiumBonus?: number[]
}

const storageKey = (eventId: string) => `flash-challenge:${eventId}`

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function read(eventId: string): FlashChallenge | null {
  try {
    const raw = localStorage.getItem(storageKey(eventId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as FlashChallenge
    if (!parsed?.id || !parsed.startedAt || !Array.isArray(parsed.completions)) return null
    return parsed
  } catch {
    // Unreadable storage reads as "no challenge", which is the setup form.
    return null
  }
}

function write(eventId: string, challenge: FlashChallenge | null): void {
  try {
    if (challenge) localStorage.setItem(storageKey(eventId), JSON.stringify(challenge))
    else localStorage.removeItem(storageKey(eventId))
  } catch {
    // Private windows and full quotas throw. The challenge then lives as long
    // as this screen does - the room still gets its challenge.
  }
}

/** When the clock runs out, in epoch ms. */
export function endsAtMs(challenge: FlashChallenge): number {
  return Date.parse(challenge.startedAt) + challenge.durationSec * 1000
}

/**
 * The moment after which a scan no longer counts: the manual close if there was
 * one, otherwise the end of the clock.
 */
export function cutoffMs(challenge: FlashChallenge): number {
  const end = endsAtMs(challenge)
  return challenge.closedAt ? Math.min(Date.parse(challenge.closedAt), end) : end
}

export function statusOf(challenge: FlashChallenge, now: number = Date.now()): FlashChallengeStatus {
  return now < cutoffMs(challenge) ? 'open' : 'closed'
}

export function remainingMs(challenge: FlashChallenge, now: number = Date.now()): number {
  return Math.max(0, cutoffMs(challenge) - now)
}

export function hasCompleted(challenge: FlashChallenge, participantId: string): boolean {
  return challenge.completions.some((c) => c.participantId === participantId)
}

/** Whatever this game has - open or finished. A finished one is its summary. */
export function loadFlashChallenge(eventId: string): FlashChallenge | null {
  return read(eventId)
}

/** Starts a challenge, discarding whatever came before. */
export function openFlashChallenge(
  eventId: string,
  draft: FlashChallengeDraft,
  now: number = Date.now(),
): FlashChallenge {
  const fresh: FlashChallenge = {
    id: createId(),
    eventId,
    title: draft.title,
    durationSec: draft.durationSec,
    points: draft.points,
    ...(draft.podiumBonus ? { podiumBonus: draft.podiumBonus } : {}),
    startedAt: new Date(now).toISOString(),
    closedAt: null,
    completions: [],
  }
  write(eventId, fresh)
  return fresh
}

/**
 * Closes it - "סיום עכשיו", or the clock running out.
 *
 * closedAt is never later than the clock's end: a timer that fires a beat late,
 * or a tab reopened an hour later, still records the challenge as ending when
 * it ended. Closing twice keeps the first cutoff.
 */
export function closeFlashChallenge(eventId: string, now: number = Date.now()): FlashChallenge | null {
  const stored = read(eventId)
  if (!stored) return null
  if (stored.closedAt) return stored
  const closed = { ...stored, closedAt: new Date(Math.min(now, endsAtMs(stored))).toISOString() }
  write(eventId, closed)
  return closed
}

/** "+30 שניות". Only a challenge still running can be extended. */
export function extendFlashChallenge(
  eventId: string,
  seconds: number,
  now: number = Date.now(),
): FlashChallenge | null {
  const stored = read(eventId)
  if (!stored || statusOf(stored, now) !== 'open') return stored
  const extended = { ...stored, durationSec: stored.durationSec + seconds }
  write(eventId, extended)
  return extended
}

/** "אתגר חדש" - back to the setup form. */
export function clearFlashChallenge(eventId: string): void {
  write(eventId, null)
}

export type AddCompletionResult =
  | { added: true; challenge: FlashChallenge; rank: number }
  | { added: false; reason: 'missing' | 'closed' | 'duplicate' }

/**
 * Records one completer, at the end of the list.
 *
 * `readAt` is when the card was scanned. A scan read before the cutoff counts
 * even if its award came back after the clock ran out - the participant was at
 * the station in time. One completion per participant per challenge.
 */
export function addFlashCompletion(
  eventId: string,
  challengeId: string,
  completion: Omit<FlashCompletion, 'at'>,
  readAt: number,
): AddCompletionResult {
  const stored = read(eventId)
  if (!stored || stored.id !== challengeId) return { added: false, reason: 'missing' }
  if (readAt >= cutoffMs(stored)) return { added: false, reason: 'closed' }
  if (hasCompleted(stored, completion.participantId)) return { added: false, reason: 'duplicate' }

  const next: FlashChallenge = {
    ...stored,
    completions: [...stored.completions, { ...completion, at: new Date(readAt).toISOString() }],
  }
  write(eventId, next)
  return { added: true, challenge: next, rank: next.completions.length }
}

export function totalAwarded(challenge: FlashChallenge): number {
  return challenge.completions.reduce((sum, c) => sum + c.points, 0)
}
