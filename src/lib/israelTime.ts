export const ISRAEL_TIMEZONE = 'Asia/Jerusalem'

export function getIsraelLocalDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ISRAEL_TIMEZONE }).format(date)
}

function getIsraelTimeParts(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date)

  const hour = parseInt(parts.find((part) => part.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find((part) => part.type === 'minute')?.value ?? '0', 10)

  return {
    hour: hour === 24 ? 0 : hour,
    minute,
  }
}

export function getIsraelHour(date: Date): number {
  return getIsraelTimeParts(date).hour
}

export function getIsraelMinute(date: Date): number {
  return getIsraelTimeParts(date).minute
}

export function toMinutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute
}

export function getIsraelMinutesSinceMidnight(date: Date): number {
  const { hour, minute } = getIsraelTimeParts(date)
  return toMinutesSinceMidnight(hour, minute)
}

export function formatTimeOfDay(hour: number, minute: number): string {
  const safeHour = Math.max(0, Math.min(23, Number.isFinite(hour) ? hour : 0))
  const safeMinute = Math.max(0, Math.min(59, Number.isFinite(minute) ? minute : 0))
  return `${safeHour.toString().padStart(2, '0')}:${safeMinute.toString().padStart(2, '0')}`
}

export function isTimeInRange(
  currentMinutes: number,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): boolean {
  const start = toMinutesSinceMidnight(startHour, startMinute)
  const end = toMinutesSinceMidnight(endHour, endMinute)
  return currentMinutes >= start && currentMinutes <= end
}

export function formatTimeRange(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): string {
  return `בין ${formatTimeOfDay(startHour, startMinute)} ל-${formatTimeOfDay(endHour, endMinute)}`
}

export function countCompletionsOnIsraelDate(
  completionTimestamps: string[],
  referenceDate: Date,
): number {
  const targetDate = getIsraelLocalDateString(referenceDate)
  return completionTimestamps.filter(
    (timestamp) => getIsraelLocalDateString(new Date(timestamp)) === targetDate,
  ).length
}
