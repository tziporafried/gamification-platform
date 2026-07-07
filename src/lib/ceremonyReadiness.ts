export const CEREMONY_PARTICIPATION_THRESHOLD = 0.6

export interface CeremonyReadiness {
  totalParticipants: number
  participatingParticipants: number
  participationRate: number
  participationPercent: number
  threshold: number
  thresholdPercent: number
  remainingPercent: number
  isReady: boolean
}

export function calculateCeremonyReadiness(
  totalParticipants: number,
  participatingParticipants: number,
  threshold = CEREMONY_PARTICIPATION_THRESHOLD,
): CeremonyReadiness {
  const safeTotal = Math.max(0, totalParticipants)
  const safeParticipating = Math.max(0, participatingParticipants)
  const cappedParticipating = safeTotal === 0 ? 0 : Math.min(safeParticipating, safeTotal)
  const participationRate = safeTotal === 0 ? 0 : cappedParticipating / safeTotal
  const participationPercent = Math.round(participationRate * 100)
  const thresholdPercent = Math.round(threshold * 100)
  const remainingPercent = safeTotal === 0 ? thresholdPercent : Math.max(0, Math.round((threshold - participationRate) * 100))

  return {
    totalParticipants: safeTotal,
    participatingParticipants: cappedParticipating,
    participationRate,
    participationPercent,
    threshold,
    thresholdPercent,
    remainingPercent,
    isReady: safeTotal > 0 && participationRate >= threshold,
  }
}
