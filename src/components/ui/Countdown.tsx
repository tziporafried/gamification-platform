import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Time left until a fixed moment, ticking once a second.
 *
 * The target is an absolute instant, so the comparison is timezone-proof: a
 * viewer in any zone sees the same remaining time, and a clock formatted from
 * these parts never depends on the browser's locale.
 */
export interface TimeLeft {
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
  isExpired: boolean
}

export function timeLeftUntil(target: Date, now: number): TimeLeft {
  const totalMs = Math.max(0, target.getTime() - now)
  const totalSeconds = Math.floor(totalMs / 1000)
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isExpired: totalMs <= 0,
  }
}

/** Live time left until `target`. Stops ticking once it hits zero. */
export function useCountdown(target: Date): TimeLeft {
  const [left, setLeft] = useState(() => timeLeftUntil(target, Date.now()))

  useEffect(() => {
    // Re-read the clock on every tick rather than counting intervals, so a
    // backgrounded or throttled tab shows the right time when it wakes up.
    setLeft(timeLeftUntil(target, Date.now()))
    const id = window.setInterval(() => {
      const next = timeLeftUntil(target, Date.now())
      setLeft(next)
      if (next.isExpired) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [target])

  return left
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

/** "5" → "5 ימים"; hidden entirely below one day. */
function daysLabel(days: number): string | null {
  if (days <= 0) return null
  return days === 1 ? '1 יום' : `${days} ימים`
}

/** Hebrew counts a pair with its own word: 2 שעות → שעתיים. */
function unit(value: number, [one, two, many]: [string, string, string]): string {
  if (value === 1) return `1 ${one}`
  if (value === 2) return two
  return `${value} ${many}`
}

/**
 * "1 יום ו-5 שעות ו-24 דקות ו-8 שניות" - leading zero units are dropped, so
 * the text shortens on its own as the deadline gets closer.
 */
export function formatTimeLeftWords({ days, hours, minutes, seconds }: TimeLeft): string {
  const parts: string[] = []
  if (days > 0) parts.push(unit(days, ['יום', 'יומיים', 'ימים']))
  if (hours > 0) parts.push(unit(hours, ['שעה', 'שעתיים', 'שעות']))
  if (minutes > 0) parts.push(unit(minutes, ['דקה', 'שתי דקות', 'דקות']))
  if (seconds > 0 || parts.length === 0) {
    parts.push(unit(seconds, ['שנייה', 'שתי שניות', 'שניות']))
  }
  // "ו-5 שעות" before a numeral, "ושעתיים" before a word.
  return parts.reduce(
    (text, part, index) =>
      index === 0 ? part : `${text} ${/^\d/.test(part) ? 'ו-' : 'ו'}${part}`,
    '',
  )
}

interface CountdownProps {
  target: Date
  /** Fires once, when the countdown reaches zero. */
  onExpire?: () => void
  /** Rendered instead of the clock after it expires (nothing by default). */
  expiredContent?: ReactNode
  /** Sits between the days and the clock, e.g. "1 יום • 05:42:18". */
  separator?: ReactNode
  /** 'clock' → "1 יום • 05:42:18"; 'words' → "1 יום ו-5 שעות ו-24 דקות". */
  format?: 'clock' | 'words'
  className?: string
}

/**
 * Live countdown to an instant. Reusable: pass any target and format.
 */
export function Countdown({
  target,
  onExpire,
  expiredContent = null,
  separator,
  format = 'clock',
  className,
}: CountdownProps) {
  const timeLeft = useCountdown(target)
  const { days, hours, minutes, seconds, isExpired } = timeLeft
  const firedRef = useRef(false)

  useEffect(() => {
    if (!isExpired || firedRef.current) return
    firedRef.current = true
    onExpire?.()
  }, [isExpired, onExpire])

  if (isExpired) return <>{expiredContent}</>

  if (format === 'words') {
    return <span className={className}>{formatTimeLeftWords(timeLeft)}</span>
  }

  const label = daysLabel(days)

  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      {label && (
        <>
          <span>{label}</span>
          {separator != null && <span aria-hidden="true">{separator}</span>}
        </>
      )}
      <span dir="ltr" className="tabular-nums">
        {`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`}
      </span>
    </span>
  )
}
