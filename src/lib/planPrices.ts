import { differenceInCalendarDays, parseISO } from 'date-fns'

/** Packages that can be selected on the admin bookings board. */
export type BookablePackage = 'independent' | 'full' | 'offline' | 'organizations'

export const PLAN_BASE_PRICES: Record<BookablePackage, number | null> = {
  independent: 40,
  full: 150,
  offline: 200,
  organizations: null,
}

/** Extra calendar day beyond the first, for full / offline. */
export const EXTRA_DAY_PRICE = 15

export const BOOKING_PACKAGE_LABELS: Record<BookablePackage, string> = {
  independent: 'משחק בסיסי',
  full: 'משחק מלא',
  offline: 'בלי אינטרנט',
  organizations: 'ארגונים',
}

export const BOOKABLE_PACKAGES: BookablePackage[] = [
  'independent',
  'full',
  'offline',
  'organizations',
]

function chargesExtraDays(pkg: BookablePackage): boolean {
  return pkg === 'full' || pkg === 'offline'
}

/** Inclusive day count between YYYY-MM-DD dates. */
export function bookingDayCount(startDate: string, endDate: string): number {
  try {
    return Math.max(1, differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1)
  } catch {
    return 1
  }
}

/**
 * Suggested list price for a booking package over a date range.
 * Returns null when the package has no fixed price (e.g. organizations).
 */
export function calculateBookingPrice(
  pkg: BookablePackage,
  startDate: string,
  endDate: string,
): number | null {
  const base = PLAN_BASE_PRICES[pkg]
  if (base == null) return null
  if (!chargesExtraDays(pkg)) return base
  const days = bookingDayCount(startDate, endDate)
  return base + EXTRA_DAY_PRICE * Math.max(0, days - 1)
}

export function formatPriceIls(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`
}
