export type RewardTargetType = 'all' | 'groups' | 'participant'
export type RewardWinnerMode = 'all' | 'first'

/** Combined UI scope - maps to target_type + winner_mode in the DB. */
export type RewardScopeId =
  | 'all_all'
  | 'all_first'
  | 'groups_all'
  | 'groups_first'

export interface RewardTargetingFields {
  target_type: RewardTargetType
  target_participant_id: string | null
  winner_mode: RewardWinnerMode
  groupIds: string[]
}

export interface RewardTargetingParticipant {
  id: string
  groupIds: string[]
}

export function rewardFieldsToScope(
  targetType: RewardTargetType,
  winnerMode: RewardWinnerMode,
): RewardScopeId {
  if (targetType === 'groups') {
    return winnerMode === 'first' ? 'groups_first' : 'groups_all'
  }
  return winnerMode === 'first' ? 'all_first' : 'all_all'
}

export function rewardScopeToFields(scope: RewardScopeId): {
  target_type: RewardTargetType
  winner_mode: RewardWinnerMode
} {
  switch (scope) {
    case 'all_first':
      return { target_type: 'all', winner_mode: 'first' }
    case 'groups_all':
      return { target_type: 'groups', winner_mode: 'all' }
    case 'groups_first':
      return { target_type: 'groups', winner_mode: 'first' }
    default:
      return { target_type: 'all', winner_mode: 'all' }
  }
}

export function isParticipantEligibleForReward(
  participant: RewardTargetingParticipant,
  reward: RewardTargetingFields,
): boolean {
  if (reward.target_type === 'participant') {
    return participant.id === reward.target_participant_id
  }
  if (reward.target_type === 'groups') {
    if (reward.groupIds.length === 0) return false
    return participant.groupIds.some((gid) => reward.groupIds.includes(gid))
  }
  return true
}

export function isRewardStillClaimable(
  reward: RewardTargetingFields & { id: string },
  participants: RewardTargetingParticipant[],
  awardedPairs: { participant_id: string; reward_id: string }[],
): boolean {
  const awarded = new Set(awardedPairs.map((p) => `${p.participant_id}:${p.reward_id}`))
  const winnersForReward = awardedPairs.filter((p) => p.reward_id === reward.id)

  if (reward.winner_mode === 'first') {
    return winnersForReward.length === 0
  }

  const eligible = participants.filter((p) => isParticipantEligibleForReward(p, reward))
  if (eligible.length === 0) return participants.length === 0
  return eligible.some((p) => !awarded.has(`${p.id}:${reward.id}`))
}

export function getRewardScopeOptionLabel(scope: RewardScopeId): string {
  return REWARD_SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? 'כל המשתתפים'
}

export function getRewardScopeLabel(
  reward: RewardTargetingFields,
  options?: { groupName?: string },
): string {
  if (reward.target_type === 'groups') {
    const groupPart = options?.groupName
      ? `קבוצת ${options.groupName}`
      : reward.groupIds.length > 1
        ? `${reward.groupIds.length} קבוצות`
        : 'קבוצות'
    return reward.winner_mode === 'first' ? `${groupPart} · הראשון` : groupPart
  }
  return reward.winner_mode === 'first' ? 'הראשון מכולם' : 'כל המשתתפים'
}

export const REWARD_SCOPE_OPTIONS: {
  value: RewardScopeId
  label: string
  description: string
  requiresGroups?: boolean
}[] = [
  {
    value: 'all_all',
    label: 'כל המשתתפים',
    description: 'כל מי שמגיע ליעד הנקודות זוכה בפרס',
  },
  {
    value: 'all_first',
    label: 'הראשון מכולם',
    description: 'רק המשתתף הראשון שמגיע ליעד זוכה בפרס',
  },
  {
    value: 'groups_all',
    label: 'קבוצות - כולם',
    description: 'כל מי שמגיע ליעד מתוך הקבוצות שנבחרו',
    requiresGroups: true,
  },
  {
    value: 'groups_first',
    label: 'קבוצות - הראשון',
    description: 'רק הראשון שמגיע ליעד מתוך הקבוצות שנבחרו',
    requiresGroups: true,
  },
]
