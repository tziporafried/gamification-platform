import type { EligibleParticipant } from '../types'

/** Milestone pool sizes used during the elimination suspense sequence. */
export const ELIMINATION_MILESTONES = [120, 60, 30, 15, 8, 5, 3, 1] as const

export function pickRandomWinner(participants: EligibleParticipant[]): EligibleParticipant {
  const index = Math.floor(Math.random() * participants.length)
  return participants[index]!
}

/**
 * Build a sequence of remaining-count targets from the starting pool size
 * down to 1, using the suspense milestones (skipping those already above start).
 */
export function buildEliminationTargets(startCount: number): number[] {
  if (startCount <= 1) return [1]
  const targets = ELIMINATION_MILESTONES.filter((n) => n < startCount)
  if (targets[targets.length - 1] !== 1) targets.push(1)
  return [...targets]
}

export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
  return items
}
