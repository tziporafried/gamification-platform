import {
  formatTimeRange,
  getIsraelMinutesSinceMidnight,
  isTimeInRange,
} from '@/lib/israelTime'
import { getDailyTimeWindow, hasDailyTimeWindow } from '@/lib/taskLimit'

export type BlockReason =
  | 'ACTION_INACTIVE'
  | 'LIMIT_REACHED'
  | 'DAILY_HOURS_OUT_OF_RANGE'
  | 'GROUP_NOT_ALLOWED'

export interface CanPerformResult {
  allowed: boolean
  reason?: BlockReason
  message: string
}

interface ActionConstraints {
  is_active: boolean
  max_completions: number | null
  daily_limit: boolean
  daily_start_hour: number | null
  daily_start_minute: number | null
  daily_end_hour: number | null
  daily_end_minute: number | null
  /** IDs of groups that may perform this action. Empty array = all groups allowed. */
  allowedGroupIds: string[]
}

interface CanPerformParams {
  action: ActionConstraints
  /** Groups the participant belongs to. */
  participantGroupIds: string[]
  /** Number of times this participant has already completed this action (lifetime). */
  previousCompletions: number
  /** Completions on the current calendar day. */
  previousCompletionsToday?: number
  /** Reference time for daily checks (defaults to now). */
  now?: Date
}

export function canPerformAction({
  action,
  participantGroupIds,
  previousCompletions,
  previousCompletionsToday = 0,
  now = new Date(),
}: CanPerformParams): CanPerformResult {
  if (!action.is_active) {
    return { allowed: false, reason: 'ACTION_INACTIVE', message: 'המשימה אינה פעילה.' }
  }

  if (action.daily_limit) {
    const dailyWindow = getDailyTimeWindow(action)
    if (hasDailyTimeWindow(dailyWindow)) {
      const currentMinutes = getIsraelMinutesSinceMidnight(now)
      if (!isTimeInRange(
        currentMinutes,
        dailyWindow.start!.hour,
        dailyWindow.start!.minute,
        dailyWindow.end!.hour,
        dailyWindow.end!.minute,
      )) {
        return {
          allowed: false,
          reason: 'DAILY_HOURS_OUT_OF_RANGE',
          message: `הסריקה זמינה ${formatTimeRange(
            dailyWindow.start!.hour,
            dailyWindow.start!.minute,
            dailyWindow.end!.hour,
            dailyWindow.end!.minute,
          )}.`,
        }
      }
    }

    if (previousCompletionsToday >= 1) {
      return {
        allowed: false,
        reason: 'LIMIT_REACHED',
        message: 'כבר בוצעה סריקה אחת למשימה זו היום.',
      }
    }
  } else if (action.max_completions !== null && previousCompletions >= action.max_completions) {
    if (action.max_completions === 1) {
      return {
        allowed: false,
        reason: 'LIMIT_REACHED',
        message: 'המשימה מוגבלת לסריקה אחת - כבר בוצעה.',
      }
    }
    return {
      allowed: false,
      reason: 'LIMIT_REACHED',
      message: `הגעת למגבלה של ${action.max_completions} סריקות למשימה זו.`,
    }
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
