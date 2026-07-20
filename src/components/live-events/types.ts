import type { LucideIcon } from 'lucide-react'
import { Gift, Sparkles, Zap } from 'lucide-react'

/** Discriminated union - add new live event kinds here as they ship. */
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

export type LiveEventCatalogId = 'lottery' | 'bonus-points' | 'flash-challenge'

export interface LiveEventCatalogItem {
  id: LiveEventCatalogId
  kind?: LiveEventKind
  title: string
  description: string
  icon: LucideIcon
  available: boolean
  cta: string
  accent: 'legendary' | 'rich' | 'medium'
}

/** Current product catalog - all live events are upcoming teasers for now. */
export const LIVE_EVENT_CATALOG: LiveEventCatalogItem[] = [
  {
    id: 'lottery',
    kind: 'lottery',
    title: 'הגרלה',
    description: 'בחרו פרס, הגדירו מי משתתף - והשיקו הגרלה משלכם.',
    icon: Gift,
    available: false,
    cta: 'יושק בקרוב',
    accent: 'legendary',
  },
  {
    id: 'bonus-points',
    title: 'נקודות בונוס',
    description: 'העניקו נקודות בונוס לשחקנים או לקבוצות שבחרתם.',
    icon: Zap,
    available: false,
    cta: 'יושק בקרוב',
    accent: 'medium',
  },
  {
    id: 'flash-challenge',
    title: 'אתגר בזק',
    description: 'השיקו אתגר מהיר ומלהיב באמצע המשחק.',
    icon: Sparkles,
    available: false,
    cta: 'יושק בקרוב',
    accent: 'rich',
  },
]

/** @deprecated Prefer LIVE_EVENT_CATALOG */
export interface LiveEventTypeMeta {
  kind: LiveEventKind
  title: string
  description: string
  icon: string
  available: boolean
}

/** @deprecated Prefer LIVE_EVENT_CATALOG */
export const LIVE_EVENT_TYPES: LiveEventTypeMeta[] = [
  {
    kind: 'lottery',
    title: 'הגרלה',
    description: 'הגרלת פרס בין משתתפים זכאים',
    icon: '🎁',
    available: false,
  },
]
