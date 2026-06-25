export type BlockReason =
  | 'ACTION_INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'LIMIT_REACHED'
  | 'GROUP_NOT_ALLOWED'

export interface CanPerformResult {
  allowed: boolean
  reason?: BlockReason
  message: string
}

interface ActionConstraints {
  is_active: boolean
  time_enabled: boolean
  start_at: string | null
  end_at: string | null
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
  now?: Date
}

/**
 * Both limits (time window AND quantity) must pass — there is no winner.
 * The action is blocked as soon as ANY condition fails.
 */
export function canPerformAction({
  action,
  participantGroupIds,
  previousCompletions,
  now = new Date(),
}: CanPerformParams): CanPerformResult {
  if (!action.is_active) {
    return { allowed: false, reason: 'ACTION_INACTIVE', message: 'המשימה אינה פעילה.' }
  }

  if (action.time_enabled) {
    if (action.start_at && now < new Date(action.start_at)) {
      return { allowed: false, reason: 'NOT_STARTED', message: 'המשימה עדיין לא התחילה.' }
    }
    if (action.end_at && now > new Date(action.end_at)) {
      return { allowed: false, reason: 'EXPIRED', message: 'המשימה הסתיימה.' }
    }
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
