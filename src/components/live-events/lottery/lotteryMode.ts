import type {
  EligibleParticipant,
  LotteryConfig,
  LotteryEligibilityMode,
  LotteryMode,
} from '../types'

/**
 * What a lottery draws from.
 *
 * The organizer makes one choice, in one row of toggles under "מי משתתף?":
 *
 *   כולם          every player on the board
 *   לפי נקודות     everyone at or above a points line
 *   לפי משתתפים    whoever took part by scanning while the round was open
 *                 (the 'scans' key - flag only)
 *   לפי קבוצות     everyone in the chosen groups
 *
 * Underneath, those four collapse into two ways of building a pool -
 * LotteryMode - because only one of them changes what a ticket is:
 *
 *   points  three of the four. The leaderboard is filtered by the choice, and
 *           each eligible player is one ticket. This is the lottery as it has
 *           always worked.
 *
 *   scan    "לפי משתתפים" alone. Points are ignored entirely; the organizer
 *           opens a round and scans people in on the lottery screen itself.
 *           One ticket each, however many times they scan, and scans taken at
 *           the game's other stations are no part of it (081).
 *
 * The mode is derived from the choice, never chosen separately, so the two
 * cannot disagree. It travels in the LotteryConfig from launch onward, and
 * nothing below reads the feature flag again: a lottery launched one way stays
 * that way even if the flag is flipped mid-event.
 *
 * Everything downstream of the pool - the intro, the raffle box, the winner
 * reveal, the redraw, the winner log - is identical for all four.
 */

/** The flag key, as created in the admin panel (see lib/eventFeatures). */
export const SCAN_BASED_LOTTERY_FLAG = 'scan_based_lottery'

/**
 * There is deliberately no separate LotteryEntrySource enum next to this.
 * Today each mode has exactly one source of tickets - eligibility, or scans -
 * so a source type would be a second name for the mode, mapped 1:1, and every
 * reader would have to be told which of the two names to branch on. If a mode
 * ever mixes sources (eligible players *plus* scan tickets, say), the place to
 * put that is a `source` on the ticket count itself, where it would actually
 * carry information.
 */

/**
 * The ways this game may pick who is in the hat.
 *
 * Three are always there. The flag *adds* 'scans'; it never takes anything
 * away, and it never changes the default - a game where it was just switched
 * on opens on exactly the dock it opened on yesterday.
 *
 * The order is the order of the toggles: the two that need nothing chosen
 * come first, then the two that need something opened or picked.
 */
export function availableEligibilityModes(scanFlagOn: boolean): LotteryEligibilityMode[] {
  return scanFlagOn
    ? ['all', 'min_points', 'scans', 'groups']
    : ['all', 'min_points', 'groups']
}

/** What the dock offers before the organizer chooses. */
export const DEFAULT_ELIGIBILITY_MODE: LotteryEligibilityMode = 'all'

/** Narrows a remembered choice to one this game may actually make. */
export function resolveEligibilityMode(
  mode: LotteryEligibilityMode,
  scanFlagOn: boolean,
): LotteryEligibilityMode {
  return availableEligibilityModes(scanFlagOn).includes(mode) ? mode : DEFAULT_ELIGIBILITY_MODE
}

/**
 * What each toggle is called.
 *
 * 'scans' reads "לפי משתתפים" on purpose - see the note on
 * LotteryEligibilityMode. The key describes the mechanism, this describes what
 * the organizer is choosing.
 */
export const ELIGIBILITY_LABELS: Record<LotteryEligibilityMode, string> = {
  all: 'כולם',
  min_points: 'לפי נקודות',
  scans: 'לפי משתתפים',
  groups: 'לפי קבוצות',
}

/**
 * Which pool loader the choice implies.
 *
 * Only 'scans' reads the round's window; the other three filter the
 * leaderboard. This is derived rather than chosen separately, so there is one
 * control in the dock and no way for the two answers to disagree.
 */
export function modeForEligibility(mode: LotteryEligibilityMode): LotteryMode {
  return mode === 'scans' ? 'scan' : 'points'
}

/** What the dock offers before the organizer chooses - today's lottery. */
export const DEFAULT_LOTTERY_MODE: LotteryMode = 'points'

/**
 * The mode a config was launched in.
 *
 * Sessions saved before this field existed have no `mode`, and they are all
 * points lotteries - a run already in flight when the code ships must keep
 * behaving as it did.
 */
export function configLotteryMode(config: Pick<LotteryConfig, 'mode'>): LotteryMode {
  return config.mode === 'scan' ? 'scan' : 'points'
}

/**
 * How many tickets one participant holds.
 *
 * Defaults to 1 for anything that predates the field - a points-mode pool, or
 * a session persisted by an older build - so an unstamped participant is one
 * name in the hat exactly as before.
 */
export function entryCount(participant: Pick<EligibleParticipant, 'entries'>): number {
  const n = participant.entries
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1
  return Math.max(0, Math.floor(n))
}

/** Tickets in the hat. In points mode this equals the number of players. */
export function totalEntries(participants: readonly EligibleParticipant[]): number {
  return participants.reduce((sum, p) => sum + entryCount(p), 0)
}

/**
 * What the intro card tells the audience the pool is.
 *
 * The dock writes this at launch (config.poolLabel), because it is the only
 * place that knows the names behind a picked set of groups - "בוגרים, מתחילים"
 * says something to the room that "2 קבוצות" does not. Everything below is the
 * fallback for a config that carries no label: the rules that can be stated
 * from the config alone, and sessions saved before the field existed.
 */
export function poolDescription(config: LotteryConfig): string {
  if (config.poolLabel?.trim()) return config.poolLabel.trim()
  if (configLotteryMode(config) === 'scan') return 'כל מי שנסרק להגרלה'
  switch (config.eligibilityMode) {
    case 'min_points':
      return `מי שהשיג מעל ${config.minPoints.toLocaleString('he-IL')} נקודות`
    case 'groups':
      return `${(config.groupIds?.length ?? 0).toLocaleString('he-IL')} קבוצות נבחרות`
    default:
      return 'כל המשתתפים'
  }
}

/**
 * The count under the launch button. A points pool counts the players the rule
 * let in ("42 זכאים"); a scan pool counts the people who scanned in
 * ("18 משתתפים"), which with one ticket each is the same as its ticket count.
 */
export function poolCountLabel(mode: LotteryMode, participants: readonly EligibleParticipant[]): string {
  if (mode === 'scan') {
    return `${participants.length.toLocaleString('he-IL')} משתתפים`
  }
  return `${participants.length.toLocaleString('he-IL')} זכאים`
}
