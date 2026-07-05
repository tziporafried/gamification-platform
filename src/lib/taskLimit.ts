import {
  formatTimeRange,
  getIsraelMinutesSinceMidnight,
  getIsraelSecondsSinceMidnight,
  isTimeInRange,
  toSecondsSinceMidnight,
} from '@/lib/israelTime'
import type { Action } from '@/types'

export type LimitMode = 'unlimited' | 'once' | 'daily' | 'limited'

export interface TimeOfDay {
  hour: number
  minute: number
}

export const QUARTER_HOUR_MINUTES = [0, 15, 30, 45] as const

export function snapToQuarterHour(minute: number): number {
  const snapped = Math.round(minute / 15) * 15
  return snapped === 60 ? 0 : Math.max(0, Math.min(45, snapped))
}

export interface DailyTimeWindow {
  start: TimeOfDay | null
  end: TimeOfDay | null
}

export const EDITOR_SUGGESTED_TIME_WINDOW: DailyTimeWindow = {
  start: { hour: 8, minute: 0 },
  end: { hour: 20, minute: 0 },
}

export function getEditorTimeDraft(window: DailyTimeWindow): { start: TimeOfDay; end: TimeOfDay } {
  if (hasDailyTimeWindow(window)) {
    return { start: window.start!, end: window.end! }
  }
  return {
    start: EDITOR_SUGGESTED_TIME_WINDOW.start!,
    end: EDITOR_SUGGESTED_TIME_WINDOW.end!,
  }
}

function isValidTimePart(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function hasDailyTimeWindow({ start, end }: DailyTimeWindow): boolean {
  if (!start || !end) return false
  return (
    isValidTimePart(start.hour)
    && isValidTimePart(start.minute)
    && isValidTimePart(end.hour)
    && isValidTimePart(end.minute)
  )
}

export function isDailyTimeWindowValid({ start, end }: DailyTimeWindow): boolean {
  if (!hasDailyTimeWindow({ start, end })) return false
  return start!.hour * 60 + start!.minute < end!.hour * 60 + end!.minute
}

export function toLimitMode(action: Pick<Action, 'max_completions' | 'daily_limit'>): LimitMode {
  if (action.daily_limit) return 'daily'
  if (action.max_completions === null) return 'unlimited'
  if (action.max_completions === 1) return 'once'
  return 'limited'
}

export function toLimitDbValues(
  mode: LimitMode,
  customLimit: number,
  dailyWindow: DailyTimeWindow,
): Pick<
  Action,
  | 'max_completions'
  | 'daily_limit'
  | 'daily_start_hour'
  | 'daily_start_minute'
  | 'daily_end_hour'
  | 'daily_end_minute'
> {
  const emptyWindow = {
    daily_start_hour: null,
    daily_start_minute: null,
    daily_end_hour: null,
    daily_end_minute: null,
  }

  if (mode === 'unlimited') {
    return { max_completions: null, daily_limit: false, ...emptyWindow }
  }
  if (mode === 'once') {
    return { max_completions: 1, daily_limit: false, ...emptyWindow }
  }
  if (mode === 'daily') {
    const window = hasDailyTimeWindow(dailyWindow) ? dailyWindow : { start: null, end: null }
    return {
      max_completions: null,
      daily_limit: true,
      daily_start_hour: window.start?.hour ?? null,
      daily_start_minute: window.start?.minute ?? null,
      daily_end_hour: window.end?.hour ?? null,
      daily_end_minute: window.end?.minute ?? null,
    }
  }
  return { max_completions: customLimit, daily_limit: false, ...emptyWindow }
}

export function isSameLimitDbValues(
  action: Pick<
    Action,
    | 'max_completions'
    | 'daily_limit'
    | 'daily_start_hour'
    | 'daily_start_minute'
    | 'daily_end_hour'
    | 'daily_end_minute'
  >,
  dbValues: ReturnType<typeof toLimitDbValues>,
): boolean {
  return (
    action.max_completions === dbValues.max_completions
    && action.daily_limit === dbValues.daily_limit
    && action.daily_start_hour === dbValues.daily_start_hour
    && action.daily_start_minute === dbValues.daily_start_minute
    && action.daily_end_hour === dbValues.daily_end_hour
    && action.daily_end_minute === dbValues.daily_end_minute
  )
}

export function getDailyTimeWindow(
  action: Pick<Action, 'daily_start_hour' | 'daily_start_minute' | 'daily_end_hour' | 'daily_end_minute'>,
): DailyTimeWindow {
  const {
    daily_start_hour: startHour,
    daily_start_minute: startMinute,
    daily_end_hour: endHour,
    daily_end_minute: endMinute,
  } = action

  if (
    !isValidTimePart(startHour)
    || !isValidTimePart(startMinute)
    || !isValidTimePart(endHour)
    || !isValidTimePart(endMinute)
  ) {
    return { start: null, end: null }
  }

  return {
    start: { hour: startHour, minute: snapToQuarterHour(startMinute) },
    end: { hour: endHour, minute: snapToQuarterHour(endMinute) },
  }
}

type DailyWindowAction = Pick<
  Action,
  | 'daily_limit'
  | 'daily_start_hour'
  | 'daily_start_minute'
  | 'daily_end_hour'
  | 'daily_end_minute'
>

export function isInDailyTimeWindow(action: DailyWindowAction, now: Date = new Date()): boolean {
  if (!action.daily_limit) return false
  const dailyWindow = getDailyTimeWindow(action)
  if (!hasDailyTimeWindow(dailyWindow)) return false
  const currentMinutes = getIsraelMinutesSinceMidnight(now)
  return isTimeInRange(
    currentMinutes,
    dailyWindow.start!.hour,
    dailyWindow.start!.minute,
    dailyWindow.end!.hour,
    dailyWindow.end!.minute,
  )
}

export function getDailyWindowRemainingMinutes(
  action: DailyWindowAction,
  now: Date = new Date(),
): number | null {
  const remainingSeconds = getDailyWindowRemainingSeconds(action, now)
  if (remainingSeconds === null) return null
  return Math.ceil(remainingSeconds / 60)
}

export function getDailyWindowRemainingSeconds(
  action: DailyWindowAction,
  now: Date = new Date(),
): number | null {
  if (!isInDailyTimeWindow(action, now)) return null
  const dailyWindow = getDailyTimeWindow(action)
  const currentSeconds = getIsraelSecondsSinceMidnight(now)
  const endSeconds = toSecondsSinceMidnight(
    dailyWindow.end!.hour,
    dailyWindow.end!.minute,
    59,
  )
  return Math.max(0, endSeconds - currentSeconds)
}

export function formatRemainingDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return 'פחות מדקה'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return minutes === 1 ? 'דקה אחת' : `${minutes} דקות`
  if (minutes === 0) return hours === 1 ? 'שעה אחת' : `${hours} שעות`
  const hourPart = hours === 1 ? 'שעה' : `${hours} שעות`
  const minutePart = minutes === 1 ? 'דקה' : `${minutes} דקות`
  return `${hourPart} ו-${minutePart}`
}

export function formatRemainingAsTimer(totalSeconds: number): {
  hours: string
  minutes: string
  seconds: string
  showHours: boolean
} {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  return {
    hours: hours.toString().padStart(2, '0'),
    minutes: minutes.toString().padStart(2, '0'),
    seconds: seconds.toString().padStart(2, '0'),
    showHours: hours > 0,
  }
}

export function getLimitLabel(
  mode: LimitMode,
  customLimit: number,
  dailyWindow: DailyTimeWindow,
): string {
  if (mode === 'unlimited') return 'ניתן לבצע ללא הגבלה'
  if (mode === 'once') return 'פעם אחת'
  if (mode === 'daily') {
    if (!hasDailyTimeWindow(dailyWindow)) return 'פעם ביום'
    return `פעם ביום ${formatTimeRange(
      dailyWindow.start!.hour,
      dailyWindow.start!.minute,
      dailyWindow.end!.hour,
      dailyWindow.end!.minute,
    )}`
  }
  return `${customLimit} סריקות`
}
