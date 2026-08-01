/**
 * Reading a group's purpose (migration 090).
 *
 * Pure, and imported by the offline player as well as the app, so nothing here
 * may reach a React context or supabase. The feature flag that decides whether
 * the organiser is *offered* the choice lives next door in groupPurposeFlag.ts.
 *
 * Everything reads through `groupPurpose`, never `group.purpose` directly: the
 * column is missing on a database that has not run 090, and left out of every
 * query that names its columns. Both cases mean "a group like all the others",
 * which is `competition` - the value that keeps the leaderboard as it was.
 */

import type { Group, GroupPurpose } from '@/types'

/** What a group is when nothing says otherwise. */
export const DEFAULT_GROUP_PURPOSE: GroupPurpose = 'competition'

/** Just enough of a group to have a purpose - the pickers select less than a row. */
type GroupLike = Pick<Group, 'purpose'>

export function groupPurpose(group: GroupLike | null | undefined): GroupPurpose {
  return group?.purpose === 'distribution' ? 'distribution' : DEFAULT_GROUP_PURPOSE
}

/** On the leaderboard, on the podium, in the ceremony. */
export function isCompetingGroup(group: GroupLike | null | undefined): boolean {
  return groupPurpose(group) !== 'distribution'
}

/** For aiming tasks, prizes and draws - and nothing else. */
export function isDistributionGroup(group: GroupLike | null | undefined): boolean {
  return groupPurpose(group) === 'distribution'
}

/** The competing half of a roster of groups, in the order it came in. */
export function competingGroups<T extends GroupLike>(groups: readonly T[]): T[] {
  return groups.filter(isCompetingGroup)
}

export function countCompetingGroups(groups: readonly GroupLike[]): number {
  return competingGroups(groups).length
}

export const GROUP_PURPOSE_LABELS: Record<GroupPurpose, string> = {
  competition: 'קבוצת תחרות',
  distribution: 'קבוצת חלוקה',
}

/** Shown under the choice - the one sentence that tells the two apart. */
export const GROUP_PURPOSE_DESCRIPTIONS: Record<GroupPurpose, string> = {
  competition: 'מתחרה מול שאר הקבוצות ומופיעה בטבלת הדירוג.',
  distribution: 'משמשת לחלוקת משימות, פרסים והגרלות בלבד - ולא מופיעה בטבלת הדירוג.',
}

/** The badge on a group card. Nothing marks the ordinary case. */
export function groupPurposeBadge(group: GroupLike | null | undefined): string | null {
  return isDistributionGroup(group) ? GROUP_PURPOSE_LABELS.distribution : null
}

/**
 * True when a write failed only because migration 090 has not been applied to
 * this database - `groups` has no `purpose` column to put the choice in.
 *
 * Only a game with the flag can reach this: everywhere else no query names the
 * column, so a database missing 090 behaves exactly as it did before.
 */
export function isMissingGroupPurposeError(message: string | null | undefined): boolean {
  if (!message) return false
  const missing =
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('column')
  return missing && message.includes('purpose')
}

export const MISSING_GROUP_PURPOSE_MESSAGE =
  'סוגי הקבוצות עדיין לא מותקנים במסד הנתונים. הריצו את APPLY_GROUP_PURPOSE.sql ונסו שוב.'
