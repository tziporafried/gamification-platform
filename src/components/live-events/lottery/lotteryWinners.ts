import type { LotteryWinnerRecord } from '../types'

const storageKey = (eventId: string) => `lottery-winners:${eventId}`

/** Persisted previous lottery winners — ready for eligibility filtering later. */
export function getLotteryWinners(eventId: string): LotteryWinnerRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(eventId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as LotteryWinnerRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getLotteryWinnerIds(eventId: string): Set<string> {
  return new Set(getLotteryWinners(eventId).map((w) => w.participantId))
}

export function recordLotteryWinner(eventId: string, winner: LotteryWinnerRecord): void {
  const existing = getLotteryWinners(eventId)
  existing.push(winner)
  localStorage.setItem(storageKey(eventId), JSON.stringify(existing))
}
