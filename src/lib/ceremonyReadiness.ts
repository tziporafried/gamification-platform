// The ceremony/leaderboard unlocks once at least this many distinct participants
// have scanned at least once. (Previously a 60% participation rate.)
export const CEREMONY_MIN_PARTICIPANTS = 2

export interface CeremonyReadiness {
  totalParticipants: number
  participatingParticipants: number
  minParticipants: number
  isReady: boolean
}

export function calculateCeremonyReadiness(
  totalParticipants: number,
  participatingParticipants: number,
  minParticipants = CEREMONY_MIN_PARTICIPANTS,
): CeremonyReadiness {
  const safeTotal = Math.max(0, totalParticipants)
  const safeParticipating = Math.max(0, participatingParticipants)
  const cappedParticipating = safeTotal === 0 ? 0 : Math.min(safeParticipating, safeTotal)
  // Never require more scanners than there are participants, so a tiny event
  // (e.g. a single participant) can still reach its ceremony.
  const required = Math.min(minParticipants, safeTotal)

  return {
    totalParticipants: safeTotal,
    participatingParticipants: cappedParticipating,
    minParticipants,
    isReady: safeTotal > 0 && cappedParticipating >= required,
  }
}
