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

export function loadLotterySession(runId: string): LotterySessionPayload | null {
  try {
    const raw = localStorage.getItem(storageKey(runId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as LotterySessionPayload
    if (!parsed?.config || !Array.isArray(parsed.participants)) return null
    return parsed
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
