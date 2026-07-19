/** Discriminated union — add new live event kinds here as they ship. */
export type LiveEventKind = 'lottery'
// | 'bonus-points'
// | 'flash-challenge'

export interface EligibleParticipant {
  id: string
  name: string
  points: number
}

export type LotteryEligibilityMode = 'all' | 'min_points'

export interface LotteryConfig {
  kind: 'lottery'
  eventId: string
  eligibilityMode: LotteryEligibilityMode
  /** Positive integer when mode is min_points; ignored for "all". */
  minPoints: number
  prizeName: string
  prizeIcon: string
  /** When true, previous winners should be excluded (filtering wired later). */
  excludePreviousWinners: boolean
}

export interface LotteryWinnerRecord {
  participantId: string
  participantName: string
  prizeName: string
  prizeIcon: string
  wonAt: string
}

export interface LiveEventTypeMeta {
  kind: LiveEventKind
  title: string
  description: string
  icon: string
  available: boolean
}

export const LIVE_EVENT_TYPES: LiveEventTypeMeta[] = [
  {
    kind: 'lottery',
    title: 'הגרלה',
    description: 'הגרלת פרס בין משתתפים זכאים',
    icon: '🎁',
    available: true,
  },
]
