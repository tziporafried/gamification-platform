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
  /** How many winners to draw (presentation may still reveal one at a time). */
  winnerCount?: number
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
  accent: 'legendary' | 'rich' | 'medium' | 'starter'
}

/** Current product catalog - Lottery is teaser for organizers; other live events too. */
export const LIVE_EVENT_CATALOG: LiveEventCatalogItem[] = [
  {
    id: 'lottery',
    kind: 'lottery',
    title: 'הגרלה',
    description: 'בחרו פרס ומשתתפים - והשיקו הגרלה משלכם.',
    icon: Gift,
    available: false,
    cta: 'יושק בקרוב',
    accent: 'starter',
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
    description: 'השיקו אתגר פתע באמצע המשחק.',
    icon: Sparkles,
    available: false,
    cta: 'יושק בקרוב',
    accent: 'rich',
  },
]

/**
 * Public availability from the catalog, with an admin-only preview for lottery QA.
 */
export function isLiveEventLaunchable(
  item: LiveEventCatalogItem,
  opts?: { isSuperAdmin?: boolean },
): boolean {
  if (item.available) return true
  return Boolean(opts?.isSuperAdmin && item.id === 'lottery')
}

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

