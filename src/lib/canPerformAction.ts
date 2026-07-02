export type BlockReason =
  | 'ACTION_INACTIVE'
  | 'LIMIT_REACHED'
  | 'GROUP_NOT_ALLOWED'

export interface CanPerformResult {
  allowed: boolean
  reason?: BlockReason
  message: string
}

interface ActionConstraints {
  is_active: boolean
  max_completions: number | null
  /** IDs of groups that may perform this action. Empty array = all groups allowed. */
  allowedGroupIds: string[]
}

interface CanPerformParams {
  action: ActionConstraints
  /** Groups the participant belongs to. */
  participantGroupIds: string[]
  /** Number of times this participant has already completed this action. */
  previousCompletions: number
}

export function canPerformAction({
  action,
  participantGroupIds,
  previousCompletions,
}: CanPerformParams): CanPerformResult {
  if (!action.is_active) {
    return { allowed: false, reason: 'ACTION_INACTIVE', message: 'המשימה אינה פעילה.' }
  }

  if (action.max_completions !== null && previousCompletions >= action.max_completions) {
    return { allowed: false, reason: 'LIMIT_REACHED', message: 'הגעת למגבלת הביצועים למשימה זו.' }
  }

  if (action.allowedGroupIds.length > 0) {
    const participantGroupSet = new Set(participantGroupIds)
    const hasAllowedGroup = action.allowedGroupIds.some((id) => participantGroupSet.has(id))
    if (!hasAllowedGroup) {
      return { allowed: false, reason: 'GROUP_NOT_ALLOWED', message: 'המשימה אינה זמינה לקבוצה שלך.' }
    }
  }

  return { allowed: true, message: '' }
}
