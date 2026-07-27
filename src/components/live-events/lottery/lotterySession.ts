import type { EligibleParticipant, LotteryConfig } from '../types'

export interface LotterySessionPayload {
  config: LotteryConfig
  participants: EligibleParticipant[]
  createdAt: number
}

const storageKey = (runId: string) => `lottery-run:${runId}`

function createRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Persist lottery payload and return a run id for the presentation URL. */
export function saveLotterySession(payload: Omit<LotterySessionPayload, 'createdAt'>): string {
  const runId = createRunId()
  const full: LotterySessionPayload = { ...payload, createdAt: Date.now() }
  localStorage.setItem(storageKey(runId), JSON.stringify(full))
  return runId
}

/**
 * A session written by an older build has no `mode` and no ticket counts on
 * its participants. Those are all points lotteries - one name, one ticket - so
 * they are normalised to exactly that rather than left for every reader to
 * guess at. A run already in flight when this ships keeps behaving as it did.
 */
function normaliseSession(parsed: LotterySessionPayload): LotterySessionPayload {
  return {
    ...parsed,
    config: { ...parsed.config, mode: parsed.config.mode ?? 'points' },
    participants: parsed.participants.map((p) => ({ ...p, entries: p.entries ?? 1 })),
  }
}

export function loadLotterySession(runId: string): LotterySessionPayload | null {
  try {
    const raw = localStorage.getItem(storageKey(runId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as LotterySessionPayload
    if (!parsed?.config || !Array.isArray(parsed.participants)) return null
    return normaliseSession(parsed)
  } catch {
    return null
  }
}

export function clearLotterySession(runId: string): void {
  localStorage.removeItem(storageKey(runId))
}

export function lotteryPresentationPath(eventId: string, runId: string): string {
  return `/events/${eventId}/lottery?run=${encodeURIComponent(runId)}`
}
