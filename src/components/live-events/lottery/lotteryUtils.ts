import type { EligibleParticipant } from '../types'
import { entryCount, totalEntries } from './lotteryMode'

/** Milestone pool sizes used during the elimination suspense sequence. */
export const ELIMINATION_MILESTONES = [120, 60, 30, 15, 8, 5, 3, 1] as const

/**
 * Draws one winner, one ticket at a time.
 *
 * The draw is over tickets, not people. Every pool today hands out exactly one
 * ticket each - the points rules always did, and the scan lottery caps it at
 * one in the database (081) - so this is the uniform pick it has always been:
 * the same `floor(random * n)` index into the same array.
 *
 * Weighing by ticket rather than by head is kept because it is what makes that
 * cap a policy instead of a structure. If a pool ever hands out more than one
 * again, this already draws it correctly and nothing else has to change.
 */
export function pickRandomWinner(participants: EligibleParticipant[]): EligibleParticipant {
  const tickets = totalEntries(participants)
  // Every ticket count is 0 (or the pool is empty): fall back to a uniform
  // pick rather than returning nothing, so the show can still go on.
  if (tickets <= 0) return participants[Math.floor(Math.random() * participants.length)]!

  let ticket = Math.floor(Math.random() * tickets)
  for (const participant of participants) {
    ticket -= entryCount(participant)
    if (ticket < 0) return participant
  }
  return participants[participants.length - 1]!
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
