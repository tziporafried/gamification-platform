import type { NewlyAwardedReward } from '@/types'
import type { GamePack, LocalAward, LocalScan } from './types'
import { getParticipantTotal } from './leaderboard'

/**
 * Local mirror of check_and_award_rewards.
 *
 * Source of truth: supabase/migrations/046_reward_targeting.sql
 * The rules encoded here - active, threshold, not-already-won, targeting, and
 * winner_mode - must match that function exactly.
 */

/** Rewards this participant has just earned. Caller records them. */
export function checkAndAwardRewards(
  pack: GamePack,
  scans: LocalScan[],
  awards: LocalAward[],
  participantId: string,
): NewlyAwardedReward[] {
  const totalPoints = getParticipantTotal(scans, participantId)

  const wonByParticipant = new Set(
    awards.filter((award) => award.participantId === participantId).map((a) => a.rewardId),
  )
  // winner_mode 'first' asks whether *anyone* has taken the reward yet.
  const wonByAnyone = new Set(awards.map((award) => award.rewardId))

  const participantGroupIds = new Set(
    pack.participantGroups
      .filter((membership) => membership.participant_id === participantId)
      .map((membership) => membership.group_id),
  )

  const earned: NewlyAwardedReward[] = []

  for (const reward of pack.rewards) {
    if (!reward.is_active) continue
    if (reward.required_points > totalPoints) continue
    if (wonByParticipant.has(reward.id)) continue

    let isTargeted = false
    if (reward.target_type === 'all') {
      isTargeted = true
    } else if (reward.target_type === 'participant') {
      isTargeted = reward.target_participant_id === participantId
    } else if (reward.target_type === 'groups') {
      isTargeted = pack.rewardGroups.some(
        (link) => link.reward_id === reward.id && participantGroupIds.has(link.group_id),
      )
    }
    if (!isTargeted) continue

    if (reward.winner_mode === 'first' && wonByAnyone.has(reward.id)) continue

    earned.push({
      out_reward_id: reward.id,
      out_reward_name: reward.name,
      out_required_points: reward.required_points,
      out_total_points: totalPoints,
    })
  }

  return earned
}

/** Turns freshly earned rewards into award records to append to game state. */
export function toLocalAwards(
  earned: NewlyAwardedReward[],
  participantId: string,
  now: Date,
): LocalAward[] {
  return earned.map((reward) => ({
    participantId,
    rewardId: reward.out_reward_id,
    scoreAtAward: reward.out_total_points,
    awardedAt: now.toISOString(),
  }))
}
