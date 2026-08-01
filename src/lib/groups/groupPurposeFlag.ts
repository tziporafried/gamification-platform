/**
 * The `group_purpose` feature flag: this game can say what each group is for.
 *
 * A group has always been a contestant. With the flag, a group can instead be a
 * distribution group - a way of aiming a task, a prize or a draw at part of the
 * roster, with no score of its own and no place on the leaderboard. "צוות היגוי"
 * stops finishing last in a competition it was never in.
 *
 * ── What the flag gates, and what it deliberately does not ───────────────────
 * The flag gates the *choosing*: the purpose selector when a group is created
 * or edited, the badge on the card, and the wizard's willingness to keep groups
 * in a game whose competition is between individuals. A game without the flag
 * sees no purpose anywhere - not a locked version of it - and every group it
 * creates is 'competition', which is what every group already was.
 *
 * Ranking is not gated, and cannot be: get_group_leaderboard is SQL and cannot
 * read the flag catalogue. It filters distribution groups out for everyone,
 * which changes nothing for a game that has none - and without the flag no
 * client can write one. Withdrawing the flag from a game that already sorted
 * its groups therefore leaves them sorted: the organiser can no longer change a
 * group's purpose, and the leaderboard keeps honouring the answer they gave.
 * The alternative - dropping four distribution groups back onto the podium
 * mid-game - would look like a bug to everyone in the room.
 *
 * Like every flag, it is created by hand in the admin panel. Until that row
 * exists this resolves off and none of the above is reachable.
 */

import { useFeatureFlag } from '@/contexts/EventFeaturesContext'

export const GROUP_PURPOSE_FLAG = 'group_purpose'

/** Can this game sort its groups into competing and distribution? */
export function useGroupPurpose(): boolean {
  return useFeatureFlag(GROUP_PURPOSE_FLAG)
}

/**
 * `groupPurpose` and the rest of the reading rules live in
 * `src/lib/groups/groupPurpose.ts`, not here: the offline player imports them
 * and must not reach the React context this file uses. Import them from there.
 */
