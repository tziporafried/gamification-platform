import type { LucideIcon } from 'lucide-react'
import { Gift, Sparkles, Zap } from 'lucide-react'

/** Discriminated union - add new live event kinds here as they ship. */
export type LiveEventKind = 'lottery' | 'bonus-points'
// | 'flash-challenge'

export interface EligibleParticipant {
  id: string
  name: string
  points: number
  /**
   * Tickets this participant holds in the draw. One, in every pool the app
   * builds today: the leaderboard rules put each eligible player in the hat
   * once, and the scan lottery allows one entry per participant.
   * Absent on sessions saved before the scan lottery shipped; read it through
   * entryCount() in lottery/lotteryMode.
   */
  entries?: number
}

/**
 * Who is in the hat - the organizer's single choice in the dock.
 *
 * 'scans' is offered only when the `scan_based_lottery` flag is on; the other
 * three are always available. It is also the one choice that changes how many
 * tickets a person holds - see LotteryMode.
 *
 * NAMING: the organizer sees 'scans' labelled "לפי משתתפים", because from the
 * floor's side that is what it means - whoever took part by scanning is in.
 * The key stays 'scans' because that is what it *does*: it opens a collection
 * and gives a ticket to each person scanned in on the lottery screen. Do not
 * rename it to match the label; the label is the product's word, the key is
 * the mechanism's.
 */
export type LotteryEligibilityMode = 'all' | 'min_points' | 'scans' | 'groups'

/**
 * How the pool is built, derived from the eligibility choice rather than
 * chosen separately - see lottery/lotteryMode for the full contract.
 */
export type LotteryMode = 'points' | 'scan'

export interface LotteryConfig {
  kind: 'lottery'
  eventId: string
  /**
   * Resolved from the `scan_based_lottery` flag when the lottery is set up.
   * Absent on sessions saved before the flag existed, which are all points
   * lotteries.
   */
  mode?: LotteryMode
  /** The collection a scan lottery drew from. Scan mode only. */
  roundId?: string
  eligibilityMode: LotteryEligibilityMode
  /** Positive integer when mode is min_points; ignored otherwise. */
  minPoints: number
  /** The chosen groups, when eligibility is 'groups'. */
  groupIds?: string[]
  /**
   * What the intro card tells the audience the pool is, written when the
   * lottery is launched. The dock is the only place that knows the chosen
   * groups' names, so it says it once here rather than making the show look
   * them up again.
   */
  poolLabel?: string
  prizeName: string
  prizeIcon: string
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
  accent: 'legendary' | 'rich' | 'medium' | 'starter' | 'accent' | 'tertiary' | 'danger' | 'muted'
}

/** Current product catalog - Lottery is teaser for organizers; other live events too. */
export const LIVE_EVENT_CATALOG: LiveEventCatalogItem[] = [
  {
    id: 'lottery',
    kind: 'lottery',
    title: 'הגרלה',
    description: 'בחרו פרס ומשתתפים - והשיקו הגרלה משלכם.',
    icon: Gift,
    available: true,
    cta: 'הפעילו הגרלה',
    accent: 'starter',
  },
  {
    id: 'bonus-points',
    kind: 'bonus-points',
    title: 'נקודות בונוס',
    description: 'העניקו נקודות למשתתף על משהו שאין לו כרטיס.',
    icon: Zap,
    available: true,
    cta: 'העניקו בונוס',
    accent: 'accent',
  },
  {
    id: 'flash-challenge',
    title: 'אתגר בזק',
    description: 'השיקו אתגר פתע באמצע המשחק.',
    icon: Sparkles,
    available: false,
    cta: 'יושק בקרוב',
    accent: 'danger',
  },
]

/** Public availability from the catalog. */
export function isLiveEventLaunchable(item: LiveEventCatalogItem): boolean {
  return item.available
}

/**
 * Where launching each event takes the organizer. Null for anything not built.
 *
 * The lottery owns a screen of its own; a bonus does not. A bonus ends in a
 * confirmation card and a row on the orange activity feed, and both of those
 * already exist on the scan screen - so it opens as a popup there rather than
 * as a second screen built around the same three fields.
 */
export function liveEventDestination(id: LiveEventCatalogId, eventId: string): string | null {
  if (id === 'lottery') return `/events/${eventId}/lottery`
  if (id === 'bonus-points') return `/events/${eventId}/kiosk?bonus=1`
  return null
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

