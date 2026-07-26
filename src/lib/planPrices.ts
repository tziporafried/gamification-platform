import { differenceInCalendarDays, parseISO } from 'date-fns'

/** Packages that can be selected on the admin bookings board. */
export type BookablePackage = 'independent' | 'full' | 'offline' | 'organizations'

/**
 * When the launch offer ends. Moving or ending the offer is a one-line edit:
 * past this moment every launch price falls back to `regular`, the crossed-out
 * price disappears and the "מחיר השקה" wording goes with it.
 */
export const LAUNCH_PRICE_EXPIRES_AT = new Date('2026-07-27T09:00:00+03:00')

export interface PlanPricing {
  /** List price - what the plan costs once the launch offer is over. */
  regular: number
  /** Launch price while the offer runs; null for plans sold at list price. */
  launch: number | null
}

/** The single source of prices - nothing in the UI hardcodes a number. */
export const PLAN_PRICING: Record<BookablePackage, PlanPricing | null> = {
  independent: { regular: 40, launch: null },
  full: { regular: 200, launch: 150 },
  offline: { regular: 250, launch: 200 },
  organizations: null,
}

export function isLaunchOfferActive(now: Date = new Date()): boolean {
  return now.getTime() < LAUNCH_PRICE_EXPIRES_AT.getTime()
}

export interface ResolvedPrice {
  /** What the customer pays today. */
  price: number
  /** The crossed-out original - null unless a launch price is running. */
  wasPrice: number | null
  onLaunchOffer: boolean
}

/** What a plan costs right now, and whether that is a launch price. */
export function resolvePlanPrice(
  pkg: BookablePackage,
  now: Date = new Date(),
): ResolvedPrice | null {
  const pricing = PLAN_PRICING[pkg]
  if (!pricing) return null
  if (pricing.launch == null || !isLaunchOfferActive(now)) {
    return { price: pricing.regular, wasPrice: null, onLaunchOffer: false }
  }
  return { price: pricing.launch, wasPrice: pricing.regular, onLaunchOffer: true }
}

/** Price of the first event day - launch price while the offer runs. */
export function planBasePrice(pkg: BookablePackage, now: Date = new Date()): number | null {
  return resolvePlanPrice(pkg, now)?.price ?? null
}

/**
 * The price tag the customer was looking at, in words - for the lead that
 * reaches us. Resolved at submit time, which is exactly what the plan cards
 * show: they re-resolve the moment the countdown hits zero, so a form left
 * open across the deadline reports the regular price, not the launch one.
 * Null for packages sold by agreement (organizations).
 */
export function describePlanPriceForLead(
  pkg: BookablePackage,
  now: Date = new Date(),
): string | null {
  const resolved = resolvePlanPrice(pkg, now)
  if (!resolved) return null
  if (resolved.onLaunchOffer && resolved.wasPrice != null) {
    return `${formatPriceIls(resolved.price)} (מחיר השקה, במקום ${formatPriceIls(resolved.wasPrice)})`
  }
  return `${formatPriceIls(resolved.price)} (מחיר רגיל)`
}

/** Extra calendar day beyond the first, for full / offline. */
export const EXTRA_DAY_PRICE = 15

export const BOOKING_PACKAGE_LABELS: Record<BookablePackage, string> = {
  independent: 'משחק ידני',
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
  const base = planBasePrice(pkg)
  if (base == null) return null
  if (!chargesExtraDays(pkg)) return base
  const days = bookingDayCount(startDate, endDate)
  return base + EXTRA_DAY_PRICE * Math.max(0, days - 1)
}

export function formatPriceIls(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`
}
