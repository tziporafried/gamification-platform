import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CalendarPlus,
  RotateCcw,
  Pencil,
  Search,
  Download,
  Sparkles,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import {
  addDays,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { he } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { fetchTemplateDraftEventIds } from '@/lib/templates'
import {
  BOOKABLE_PACKAGES,
  BOOKING_PACKAGE_LABELS,
  EXTRA_DAY_PRICE,
  planBasePrice,
  bookingDayCount,
  calculateBookingPrice,
  formatPriceIls,
  type BookablePackage,
} from '@/lib/planPrices'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { TrialActivationResetModal } from '@/components/TrialActivationResetModal'
import { EventFeaturesModal } from '@/components/admin/EventFeaturesModal'
import { EVENT_PLAN_OPTIONS, eventPlanLabel } from '@/lib/eventPlanLabels'
import {
  isMissingFeatureTableError,
  summariseOverrides,
  type EventFeatureOverride,
} from '@/lib/eventFeatures'
import { useFeatureCatalog } from '@/hooks/useEventFeatures'
import { exportOfflineGame, OfflineExportError } from '@/lib/offline/exportGame'
import { adminLabel, type FinanceAdmin } from '@/lib/financeSplit'

type BookingAdmin = Pick<FinanceAdmin, 'id' | 'email' | 'display_name'>
import { trackTrialActivated, trackTrialDataReset } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import type { BarcodeType, BookingPackage, Scanner, ScannerBooking, UserPlan } from '@/types'

const BARCODE_TYPE_OPTIONS: { value: BarcodeType; label: string; hint: string }[] = [
  { value: 'qr', label: 'דו-ממדי (QR)', hint: 'ברירת מחדל' },
  { value: 'code128', label: 'חד-ממדי', hint: 'ברקוד ליניארי' },
]

type EventOption = {
  id: string
  name: string
  plan: string
  status: string
  owner_admin_id: string
  owner_name: string
  owner_email: string
  barcode_type: BarcodeType
}

function ownerDisplayName(displayName: string | null, email: string) {
  return displayName?.trim() || email.split('@')[0] || email
}

function eventLinkCustomerLabel(ev: { owner_name: string; owner_email: string }) {
  return ev.owner_name.trim() || ev.owner_email || 'לקוח'
}

function eventLinkGameLabel(ev: { name: string }) {
  return ev.name?.trim() || 'ללא שם'
}

const SCANNER_COLORS = [
  'bg-secondary/80',
  'bg-primary/80',
  'bg-tertiary/80',
  'bg-success/70',
  'bg-warning/80',
  'bg-accent/80',
  'bg-danger/70',
]

/** High-contrast family bar colors (inline styles - reliable on calendar overlays). */
const FAMILY_BAR_PALETTE = [
  { bg: '#0f766e', text: '#ffffff' },
  { bg: '#1d4ed8', text: '#ffffff' },
  { bg: '#b45309', text: '#ffffff' },
  { bg: '#be123c', text: '#ffffff' },
  { bg: '#7c3aed', text: '#ffffff' },
  { bg: '#047857', text: '#ffffff' },
  { bg: '#c2410c', text: '#ffffff' },
  { bg: '#0369a1', text: '#ffffff' },
  { bg: '#a21caf', text: '#ffffff' },
  { bg: '#4d7c0f', text: '#ffffff' },
]

const WEEKDAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function formatRange(start: string, end: string): string {
  const s = format(parseISO(start), 'd/M/yy')
  const e = format(parseISO(end), 'd/M/yy')
  return s === e ? s : `${s} – ${e}`
}

function bookingCoversDay(booking: ScannerBooking, day: Date): boolean {
  try {
    return isWithinInterval(day, {
      start: parseISO(booking.start_date),
      end: parseISO(booking.end_date),
    })
  } catch {
    return false
  }
}

/** 'free' = no price set, nothing is owed. Otherwise how much of the price has
 *  come in, derived the same way the detail card computes its "תשלום" line. */
type PaymentState = 'paid' | 'partial' | 'unpaid' | 'free'
function bookingPaymentState(booking: ScannerBooking): PaymentState {
  const total = booking.amount != null ? Number(booking.amount) : null
  if (total == null || total <= 0) return 'free'
  const paid =
    booking.amount_paid != null ? Number(booking.amount_paid) : booking.is_paid ? total : 0
  if (paid <= 0) return 'unpaid'
  if (paid < total) return 'partial'
  return 'paid'
}

const UNPAID_DOT = '#DC2626'
const PARTIAL_DOT = '#F59E0B'

/** A small ringed dot flagging an outstanding balance on a calendar bar.
 *  Renders nothing once the booking is fully paid (or has no price). */
function OutstandingDot({ state }: { state: PaymentState }) {
  if (state !== 'unpaid' && state !== 'partial') return null
  return (
    <span
      className="ms-1 h-2 w-2 shrink-0 rounded-full ring-1 ring-white/85"
      style={{ backgroundColor: state === 'unpaid' ? UNPAID_DOT : PARTIAL_DOT }}
      title={state === 'unpaid' ? 'לא שולם' : 'שולם חלקית'}
    />
  )
}

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

function colorForScanner(scanners: Scanner[], scannerId: string | null): string {
  if (!scannerId) return 'bg-muted'
  const idx = scanners.findIndex((s) => s.id === scannerId)
  return SCANNER_COLORS[idx >= 0 ? idx % SCANNER_COLORS.length : 0]
}

function hashString(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return h
}

type FamilyColor = { bg: string; text: string }

/** Beyond the curated palette, golden-angle hues keep generated colors apart. */
function generatedFamilyColor(offset: number): FamilyColor {
  const hue = Math.round((offset * 137.508) % 360)
  return { bg: `hsl(${hue} 58% ${offset % 2 === 0 ? 34 : 27}%)`, text: '#ffffff' }
}

function familyColorAt(slot: number): FamilyColor {
  return slot < FAMILY_BAR_PALETTE.length
    ? FAMILY_BAR_PALETTE[slot]
    : generatedFamilyColor(slot - FAMILY_BAR_PALETTE.length)
}

/**
 * One color per family, never shared. The hash picks the preferred slot so a
 * family keeps its color as bookings come and go; collisions probe forward to
 * the next free slot, and the slot count grows with the number of families.
 */
function buildFamilyColors(customerNames: string[]): Map<string, FamilyColor> {
  const names = [...new Set(customerNames.map((n) => n.trim()).filter(Boolean))].sort()
  const slots = Math.max(FAMILY_BAR_PALETTE.length, names.length)
  const taken = new Set<number>()
  const colors = new Map<string, FamilyColor>()
  for (const name of names) {
    let slot = hashString(name) % slots
    while (taken.has(slot)) slot = (slot + 1) % slots
    taken.add(slot)
    colors.set(name, familyColorAt(slot))
  }
  return colors
}

function colorForFamily(
  colors: Map<string, FamilyColor>,
  customerName: string,
): FamilyColor {
  return colors.get(customerName.trim()) ?? FAMILY_BAR_PALETTE[0]
}

/** A day already gone - dimmed, and not worth showing free capacity for. */
function isPastDay(day: Date): boolean {
  return day < startOfDay(new Date())
}

function dayISO(day: Date): string {
  return format(day, 'yyyy-MM-dd')
}

/**
 * The board looks forward, not at a calendar month.
 *
 * A month grid spends most of its width on days that have already happened -
 * on the 27th, three quarters of it is history. Both boards therefore share
 * one window that starts on the current week and runs forward, so the first
 * thing on screen is today and everything after it.
 */
const WINDOW_WEEKS = 4
const WINDOW_DAYS = WINDOW_WEEKS * 7
/** One page back / forward, deliberately shorter than the window: the week of
 *  overlap keeps a booking that straddles the edge visible on both pages. */
const PAGE_DAYS = 21

/** Clip a booking to the visible day list for the scanner timeline. */
function bookingSpanInDays(
  booking: ScannerBooking,
  days: Date[],
): { start: number; span: number } | null {
  if (days.length === 0) return null
  const dStart = dayISO(days[0])
  const dEnd = dayISO(days[days.length - 1])
  if (booking.end_date < dStart || booking.start_date > dEnd) return null
  const clipStart = booking.start_date < dStart ? dStart : booking.start_date
  const clipEnd = booking.end_date > dEnd ? dEnd : booking.end_date
  const start = days.findIndex((d) => dayISO(d) === clipStart)
  const end = days.findIndex((d) => dayISO(d) === clipEnd)
  if (start < 0 || end < 0) return null
  return { start, span: end - start + 1 }
}

export function AdminScannersPanel() {
  const { user } = useAuth()
  const [scanners, setScanners] = useState<Scanner[]>([])
  const [bookings, setBookings] = useState<ScannerBooking[]>([])
  const [events, setEvents] = useState<EventOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  // Anchored to a week start so the grid's columns stay Sunday-first.
  const [windowStart, setWindowStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  )

  const [bookingOpen, setBookingOpen] = useState(false)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)
  /** When true, package/date changes recalculate the amount field. */
  const [autoPrice, setAutoPrice] = useState(true)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resetEventTarget, setResetEventTarget] = useState<{
    eventId: string
    eventName: string
  } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<ScannerBooking | null>(null)
  const [eventActionsBooking, setEventActionsBooking] = useState<ScannerBooking | null>(null)
  const [updatingEventPlan, setUpdatingEventPlan] = useState(false)
  const [exportingOffline, setExportingOffline] = useState(false)
  const [offlineExportError, setOfflineExportError] = useState<string | null>(null)
  const [featuresTarget, setFeaturesTarget] = useState<{ eventId: string; plan: UserPlan } | null>(null)
  const [featureOverrides, setFeatureOverrides] = useState<Record<string, EventFeatureOverride[]>>({})
  const { catalog: featureCatalog } = useFeatureCatalog()
  const [eventActionError, setEventActionError] = useState<string | null>(null)
  const [pendingPlanChange, setPendingPlanChange] = useState<{
    eventId: string
    previousPlan: UserPlan
    newPlan: UserPlan
  } | null>(null)
  const [activatingPlan, setActivatingPlan] = useState(false)
  const [pendingBarcodeChange, setPendingBarcodeChange] = useState<{
    eventId: string
    newType: BarcodeType
  } | null>(null)
  const [updatingBarcode, setUpdatingBarcode] = useState(false)

  // booking form
  const [formScannerId, setFormScannerId] = useState('')
  const [formEventId, setFormEventId] = useState('')
  const [eventLinkQuery, setEventLinkQuery] = useState('')
  const [eventLinkOpen, setEventLinkOpen] = useState(false)
  const [formPackage, setFormPackage] = useState<BookablePackage | ''>('')
  const [formAmount, setFormAmount] = useState('')
  const [formPaid, setFormPaid] = useState(false)
  const [formAmountPaid, setFormAmountPaid] = useState('')
  const [formStart, setFormStart] = useState(todayISO)
  const [formEnd, setFormEnd] = useState(todayISO)
  const [formCustomer, setFormCustomer] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formCollectedBy, setFormCollectedBy] = useState('')
  const [admins, setAdmins] = useState<BookingAdmin[]>([])

  // scanner form
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newNotes, setNewNotes] = useState('')
  /** Null = the scanner modal is adding; otherwise editing this scanner. */
  const [editingScannerId, setEditingScannerId] = useState<string | null>(null)

  // Flag overrides for every game at once: the game-actions dialog shows a
  // per-game summary and cannot call a hook per row.
  const refreshFeatureOverrides = useCallback(async () => {
    try {
      const { data, error: featureError } = await supabase
        .from('event_features')
        .select('event_id, feature_key, enabled, note, price_ils')
      if (featureError) {
        if (!isMissingFeatureTableError(featureError.message)) throw featureError
        setFeatureOverrides({})
        return
      }
      const byEvent: Record<string, EventFeatureOverride[]> = {}
      for (const row of (data ?? []) as (EventFeatureOverride & { event_id: string })[]) {
        ;(byEvent[row.event_id] ??= []).push(row)
      }
      setFeatureOverrides(byEvent)
    } catch {
      // The board still works without them; games fall back to their plan.
      setFeatureOverrides({})
    }
  }, [])

  useEffect(() => {
    async function fetchData() {
      const [scannersRes, bookingsRes, eventsRes, adminsRes, draftIds] = await Promise.all([
        supabase
          .from('scanners')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('scanner_bookings')
          .select('*')
          .order('start_date', { ascending: true }),
        supabase
          .from('events')
          .select('id, name, plan, status, owner_admin_id, barcode_type')
          .neq('status', 'archived')
          .order('created_at', { ascending: false }),
        supabase
          .from('user_profiles')
          .select('id, email, display_name')
          .eq('role', 'super_admin')
          .order('display_name', { ascending: true }),
        fetchTemplateDraftEventIds(),
      ])

      setAdmins((adminsRes.data as BookingAdmin[]) ?? [])

      if (scannersRes.error) setError(scannersRes.error.message)
      else setScanners((scannersRes.data as Scanner[]) ?? [])

      if (bookingsRes.error) setError(bookingsRes.error.message)
      else setBookings((bookingsRes.data as ScannerBooking[]) ?? [])

      if (eventsRes.error) {
        setError(eventsRes.error.message)
        setEvents([])
      } else {
        const draftSet = new Set(draftIds)
        const rows = ((eventsRes.data as Array<{
          id: string
          name: string
          plan: string
          status: string
          owner_admin_id: string
          barcode_type: BarcodeType
        }>) ?? []).filter((e) => !draftSet.has(e.id))
        const ownerIds = [...new Set(rows.map((r) => r.owner_admin_id))]
        const { data: profiles } = ownerIds.length
          ? await supabase
              .from('user_profiles')
              .select('id, display_name, email')
              .in('id', ownerIds)
          : { data: [] as { id: string; display_name: string | null; email: string }[] }
        const profileMap = new Map(
          (profiles ?? []).map((p) => [p.id, p]),
        )
        setEvents(
          rows.map((row) => {
            const profile = profileMap.get(row.owner_admin_id)
            const email = profile?.email ?? ''
            return {
              id: row.id,
              name: row.name,
              plan: row.plan,
              status: row.status,
              owner_admin_id: row.owner_admin_id,
              owner_name: profile ? ownerDisplayName(profile.display_name, email) : 'משתמש לא ידוע',
              owner_email: email,
              barcode_type: row.barcode_type ?? 'qr',
            }
          }),
        )
      }

      setLoading(false)
    }
    fetchData()
    void refreshFeatureOverrides()
  }, [refreshFeatureOverrides])

  const activeScanners = useMemo(
    () => scanners.filter((s) => s.status !== 'retired'),
    [scanners],
  )

  /** The one window both boards render - the week grid and the occupancy strip. */
  const windowDays = useMemo(
    () =>
      eachDayOfInterval({
        start: windowStart,
        end: addDays(windowStart, WINDOW_DAYS - 1),
      }),
    [windowStart],
  )

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of events) map.set(e.id, e.name?.trim() || 'משחק ללא שם')
    return map
  }, [events])

  const eventById = useMemo(() => {
    const map = new Map<string, EventOption>()
    for (const e of events) map.set(e.id, e)
    return map
  }, [events])

  const filteredLinkEvents = useMemo(() => {
    const q = eventLinkQuery.trim().toLowerCase()
    const list = q
      ? events.filter((ev) => {
          const customer = eventLinkCustomerLabel(ev).toLowerCase()
          const email = ev.owner_email.toLowerCase()
          const game = eventLinkGameLabel(ev).toLowerCase()
          return customer.includes(q) || email.includes(q) || game.includes(q)
        })
      : events
    return list.slice(0, 50)
  }, [events, eventLinkQuery])

  const selectedLinkEvent = formEventId ? eventById.get(formEventId) ?? null : null

  const suggestedPrice = useMemo(() => {
    if (!formPackage) return null
    return calculateBookingPrice(formPackage, formStart, formEnd)
  }, [formPackage, formStart, formEnd])

  // Recalculate amount when package or dates change (unless editing with a locked manual price).
  useEffect(() => {
    if (!autoPrice) return
    if (!formPackage) {
      setFormAmount('')
      return
    }
    const suggested = calculateBookingPrice(formPackage, formStart, formEnd)
    setFormAmount(suggested != null ? String(suggested) : '')
  }, [formPackage, formStart, formEnd, autoPrice])

  const editingBooking = useMemo(
    () => (editingBookingId ? bookings.find((b) => b.id === editingBookingId) ?? null : null),
    [bookings, editingBookingId],
  )

  const selectedDayBookings = useMemo(() => {
    if (!selectedDay) return []
    return bookings.filter((b) => bookingCoversDay(b, selectedDay))
  }, [bookings, selectedDay])

  const familyColors = useMemo(
    () => buildFamilyColors(bookings.map((b) => b.customer_name)),
    [bookings],
  )

  const windowEnd = windowDays[windowDays.length - 1]

  /** Which months the window covers, so the strip can label the switch-over. */
  const monthBands = useMemo(() => {
    const bands: { key: string; label: string; span: number }[] = []
    for (const day of windowDays) {
      const key = format(day, 'yyyy-MM')
      const last = bands[bands.length - 1]
      if (last && last.key === key) last.span += 1
      else bands.push({ key, label: format(day, 'MMMM', { locale: he }), span: 1 })
    }
    return bands
  }, [windowDays])

  const todayInWindow = useMemo(
    () => windowDays.some((d) => isSameDay(d, new Date())),
    [windowDays],
  )

  /**
   * One column template for every row, so the board lines up down its height.
   * 60px is set by the narrowest thing that has to stay readable: a one-day
   * booking, whose bar has ~52px left for the customer name once its padding
   * is taken off. Narrower and single days go back to being anonymous blocks.
   */
  const boardColumns = `160px repeat(${windowDays.length}, minmax(60px, 1fr))`

  /** Scanners still free to sell, per visible day. */
  const capacityByDay = useMemo(() => {
    const bookable = activeScanners.filter((s) => s.status === 'active')
    return windowDays.map((day) => {
      const taken = bookable.filter((scanner) =>
        bookings.some((b) => b.scanner_id === scanner.id && bookingCoversDay(b, day)),
      ).length
      return { total: bookable.length, free: Math.max(0, bookable.length - taken) }
    })
  }, [windowDays, activeScanners, bookings])

  const rangeLabel = isSameMonth(windowStart, windowEnd)
    ? format(windowStart, 'MMMM yyyy', { locale: he })
    : `${format(windowStart, 'MMMM', { locale: he })} – ${format(windowEnd, 'MMMM yyyy', { locale: he })}`

  function scannerLabel(id: string | null): string {
    if (!id) return 'ללא סורק'
    const s = scanners.find((x) => x.id === id)
    return s ? s.name : 'סורק'
  }

  function eventLabel(id: string | null): string {
    if (!id) return 'לא מקושר'
    return eventNameById.get(id) ?? 'משחק לא נמצא'
  }

  function openDayDetail(day: Date) {
    setSelectedBooking(null)
    setSelectedDay(day)
  }

  function openBookingDetail(booking: ScannerBooking) {
    setSelectedDay(null)
    setSelectedBooking(booking)
  }

  function closeDetail() {
    setSelectedDay(null)
    setSelectedBooking(null)
  }

  /** Whoever is filling the form is the likeliest one taking the payment. */
  function defaultCollector(): string {
    if (user?.id && admins.some((a) => a.id === user.id)) return user.id
    return admins[0]?.id ?? ''
  }

  function closeBookingForm() {
    setBookingOpen(false)
    setEditingBookingId(null)
    setAutoPrice(true)
    setEventLinkQuery('')
    setEventLinkOpen(false)
    setFormAmountPaid('')
    setFormPaid(false)
  }

  function openBooking(day?: Date) {
    const iso = day ? format(day, 'yyyy-MM-dd') : todayISO()
    setEditingBookingId(null)
    setAutoPrice(true)
    setFormStart(iso)
    setFormEnd(iso)
    setFormCustomer('')
    setFormPhone('')
    setFormEmail('')
    setFormNotes('')
    setFormScannerId('')
    setFormEventId('')
    setEventLinkQuery('')
    setEventLinkOpen(false)
    setFormPackage('full')
    setFormAmount(String(calculateBookingPrice('full', iso, iso) ?? planBasePrice('full') ?? 0))
    setFormPaid(false)
    setFormAmountPaid('')
    setFormCollectedBy(defaultCollector())
    setError(null)
    closeDetail()
    setBookingOpen(true)
  }

  function openEditBooking(booking: ScannerBooking) {
    setEditingBookingId(booking.id)
    setAutoPrice(false)
    setFormStart(booking.start_date)
    setFormEnd(booking.end_date)
    setFormCustomer(booking.customer_name)
    setFormPhone(booking.customer_phone ?? '')
    setFormEmail(booking.customer_email ?? '')
    setFormNotes(booking.notes ?? '')
    setFormScannerId(booking.scanner_id ?? '')
    setFormEventId(booking.event_id ?? '')
    setEventLinkQuery('')
    setEventLinkOpen(false)
    setFormPackage((booking.booking_package as BookablePackage | null) ?? 'full')
    setFormAmount(booking.amount != null ? String(booking.amount) : '')
    const paid = booking.amount_paid != null ? Number(booking.amount_paid) : booking.is_paid ? Number(booking.amount ?? 0) : 0
    setFormPaid(paid > 0 || booking.is_paid)
    setFormAmountPaid(paid > 0 ? String(paid) : booking.is_paid && booking.amount != null ? String(booking.amount) : '')
    setFormCollectedBy(booking.collected_by ?? defaultCollector())
    setError(null)
    closeDetail()
    setBookingOpen(true)
  }

  function packageLabel(pkg: string | null | undefined): string {
    if (!pkg) return 'ללא חבילה'
    return BOOKING_PACKAGE_LABELS[pkg as BookablePackage] ?? pkg
  }

  function selectLinkedEvent(ev: EventOption) {
    setFormEventId(ev.id)
    setEventLinkQuery('')
    setEventLinkOpen(false)
    if (!formCustomer.trim()) setFormCustomer(ev.owner_name)
    if (!formEmail.trim() && ev.owner_email) setFormEmail(ev.owner_email)
  }

  function clearLinkedEvent() {
    setFormEventId('')
    setEventLinkQuery('')
    setEventLinkOpen(false)
  }

  function openAddScanner() {
    const nextNum = scanners.length + 1
    setEditingScannerId(null)
    setNewName(`סורק ${nextNum}`)
    setNewCode(`SCAN-${String(nextNum).padStart(2, '0')}`)
    setNewNotes('')
    setError(null)
    setScannerOpen(true)
  }

  function openEditScanner(scanner: Scanner) {
    setEditingScannerId(scanner.id)
    setNewName(scanner.name)
    setNewCode(scanner.code)
    setNewNotes(scanner.notes ?? '')
    setError(null)
    setScannerOpen(true)
  }

  async function upsertFinanceEntry(options: {
    existingId: string | null
    entryType: 'income' | 'future_income'
    amount: number
    description: string
    collectedBy: string | null
  }): Promise<{ id: string | null; error: string | null; createdNew: boolean }> {
    const { existingId, entryType, amount, description, collectedBy } = options
    if (existingId) {
      const { error: financeError } = await supabase
        .from('admin_finance_entries')
        .update({
          entry_type: entryType,
          amount,
          description,
          entry_date: formStart,
          admin_user_id: collectedBy,
        })
        .eq('id', existingId)
      if (financeError) {
        const msg = financeError.message ?? ''
        return {
          id: null,
          createdNew: false,
          error:
            msg.includes('entry_type') || msg.includes('check')
              ? 'יש להריץ את עדכון מסד הנתונים (APPLY_BOOKING_PAID_FUTURE_INCOME.sql)'
              : msg,
        }
      }
      return { id: existingId, error: null, createdNew: false }
    }

    if (!user) return { id: null, error: 'יש להתחבר מחדש', createdNew: false }
    const { data: financeRow, error: financeError } = await supabase
      .from('admin_finance_entries')
      .insert({
        entry_type: entryType,
        amount,
        description,
        entry_date: formStart,
        admin_user_id: collectedBy,
        created_by: user.id,
      })
      .select('id')
      .single()
    if (financeError || !financeRow) {
      const msg = financeError?.message ?? ''
      return {
        id: null,
        createdNew: false,
        error:
          msg.includes('entry_type') || msg.includes('check')
            ? 'יש להריץ את עדכון מסד הנתונים (APPLY_BOOKING_PAID_FUTURE_INCOME.sql)'
            : msg || 'שגיאה בשמירת התשלום',
      }
    }
    return { id: financeRow.id as string, error: null, createdNew: true }
  }

  async function deleteFinanceEntry(id: string | null) {
    if (!id) return null as string | null
    const { error } = await supabase.from('admin_finance_entries').delete().eq('id', id)
    return error?.message ?? null
  }

  async function syncBookingFinance(options: {
    existingFinanceId: string | null
    existingDebtFinanceId: string | null
    amount: number | null
    amountPaid: number
    customer: string
    pkg: BookablePackage
    collectedBy: string | null
  }): Promise<{
    financeEntryId: string | null
    debtFinanceEntryId: string | null
    error: string | null
  }> {
    const { existingFinanceId, existingDebtFinanceId, amount, amountPaid, customer, pkg, collectedBy } =
      options
    const pkgLabel = BOOKING_PACKAGE_LABELS[pkg]
    const base = `הזמנה: ${customer} · ${pkgLabel} · ${formatRange(formStart, formEnd)}`
    const total = amount != null && amount > 0 ? amount : 0
    const paid = Math.min(Math.max(0, amountPaid), total)
    const debt = Math.max(0, total - paid)

    let financeEntryId: string | null = existingFinanceId
    let debtFinanceEntryId: string | null = existingDebtFinanceId
    const createdIds: string[] = []

    if (total <= 0) {
      const delIncome = await deleteFinanceEntry(existingFinanceId)
      if (delIncome) return { financeEntryId: null, debtFinanceEntryId: null, error: delIncome }
      const delDebt = await deleteFinanceEntry(existingDebtFinanceId)
      if (delDebt) return { financeEntryId: null, debtFinanceEntryId: null, error: delDebt }
      return { financeEntryId: null, debtFinanceEntryId: null, error: null }
    }

    if (paid > 0) {
      const res = await upsertFinanceEntry({
        existingId: existingFinanceId,
        entryType: 'income',
        amount: paid,
        description: debt > 0 ? `${base} · שולם חלקית` : base,
        collectedBy,
      })
      if (res.error) return { financeEntryId: null, debtFinanceEntryId: null, error: res.error }
      financeEntryId = res.id
      if (res.createdNew && res.id) createdIds.push(res.id)
    } else if (existingFinanceId) {
      // Unpaid: reuse the main finance row as future_income for the full amount.
      financeEntryId = existingFinanceId
    }

    if (paid <= 0) {
      // Entire amount is debt / future income - keep on finance_entry_id, clear debt row.
      const res = await upsertFinanceEntry({
        existingId: financeEntryId,
        entryType: 'future_income',
        amount: total,
        description: base,
        collectedBy,
      })
      if (res.error) {
        for (const id of createdIds) await deleteFinanceEntry(id)
        return { financeEntryId: null, debtFinanceEntryId: null, error: res.error }
      }
      financeEntryId = res.id
      if (res.createdNew && res.id) createdIds.push(res.id)
      const delDebt = await deleteFinanceEntry(existingDebtFinanceId)
      if (delDebt) {
        for (const id of createdIds) await deleteFinanceEntry(id)
        return { financeEntryId: null, debtFinanceEntryId: null, error: delDebt }
      }
      return { financeEntryId, debtFinanceEntryId: null, error: null }
    }

    if (debt > 0) {
      const res = await upsertFinanceEntry({
        existingId: existingDebtFinanceId,
        entryType: 'future_income',
        amount: debt,
        description: `${base} · לא שולם`,
        collectedBy,
      })
      if (res.error) {
        for (const id of createdIds) await deleteFinanceEntry(id)
        return { financeEntryId: null, debtFinanceEntryId: null, error: res.error }
      }
      debtFinanceEntryId = res.id
    } else {
      const delDebt = await deleteFinanceEntry(existingDebtFinanceId)
      if (delDebt) {
        for (const id of createdIds) await deleteFinanceEntry(id)
        return { financeEntryId: null, debtFinanceEntryId: null, error: delDebt }
      }
      debtFinanceEntryId = null
    }

    return { financeEntryId, debtFinanceEntryId, error: null }
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault()
    if (!user || saving) return

    const customer = formCustomer.trim()
    if (!customer) {
      setError('יש להזין שם לקוח / משפחה')
      return
    }
    if (!formPackage) {
      setError('יש לבחור חבילה')
      return
    }
    if (formEnd < formStart) {
      setError('תאריך סיום חייב להיות אחרי תאריך התחלה')
      return
    }

    const amountRaw = formAmount.trim()
    const amount = amountRaw === '' ? null : Number(amountRaw)
    if (amountRaw !== '' && (!Number.isFinite(amount) || (amount as number) < 0)) {
      setError('מחיר לא תקין')
      return
    }

    const total = amount ?? 0
    let amountPaid = 0
    if (formPaid) {
      const paidRaw = formAmountPaid.trim()
      if (paidRaw === '') {
        amountPaid = total
      } else {
        amountPaid = Number(paidRaw)
        if (!Number.isFinite(amountPaid) || amountPaid < 0) {
          setError('סכום ששולם לא תקין')
          return
        }
        if (total > 0 && amountPaid > total) {
          setError('סכום ששולם לא יכול להיות גבוה מהמחיר')
          return
        }
      }
    }

    if (formScannerId) {
      const conflict = bookings.some(
        (b) =>
          b.id !== editingBookingId &&
          b.scanner_id === formScannerId &&
          rangesOverlap(formStart, formEnd, b.start_date, b.end_date),
      )
      if (conflict) {
        setError('הסורק כבר תפוס בתאריכים האלה')
        return
      }
    }

    setSaving(true)
    setError(null)
    setSuccessMsg(null)

    const existingFinanceId = editingBooking?.finance_entry_id ?? null
    const existingDebtFinanceId = editingBooking?.debt_finance_entry_id ?? null
    // With nothing paid we don't know whose hands the money lands in, so the
    // booking (and its future-income row) stays unattributed until it is.
    const collectedBy = amountPaid > 0 ? formCollectedBy || null : null
    const {
      financeEntryId,
      debtFinanceEntryId,
      error: financeSyncError,
    } = await syncBookingFinance({
      existingFinanceId,
      existingDebtFinanceId,
      amount,
      amountPaid,
      customer,
      pkg: formPackage,
      collectedBy,
    })
    if (financeSyncError) {
      setError(financeSyncError)
      setSaving(false)
      return
    }

    const payload = {
      scanner_id: formScannerId || null,
      event_id: formEventId || null,
      booking_package: formPackage as BookingPackage,
      amount,
      amount_paid: amountPaid,
      is_paid: amountPaid > 0,
      finance_entry_id: financeEntryId,
      debt_finance_entry_id: debtFinanceEntryId,
      collected_by: collectedBy,
      start_date: formStart,
      end_date: formEnd,
      customer_name: customer,
      customer_phone: formPhone.trim() || null,
      customer_email: formEmail.trim() || null,
      notes: formNotes.trim() || null,
    }

    if (editingBookingId) {
      const { data, error: updateError } = await supabase
        .from('scanner_bookings')
        .update(payload)
        .eq('id', editingBookingId)
        .select()
        .single()

      if (updateError || !data) {
        setError(
          updateError?.message?.includes('scanner_bookings_no_overlap') ||
            updateError?.message?.includes('exclusion')
            ? 'הסורק כבר תפוס בתאריכים האלה'
            : updateError?.message?.includes('collected_by')
              ? 'יש להריץ את עדכון מסד הנתונים (APPLY_FINANCE_INCOME_ATTRIBUTION.sql)'
              : updateError?.message?.includes('amount_paid') ||
                  updateError?.message?.includes('debt_finance')
                ? 'יש להריץ את עדכון מסד הנתונים (APPLY_BOOKING_PARTIAL_PAYMENT.sql)'
              : updateError?.message ?? 'שגיאה בעדכון',
        )
        setSaving(false)
        return
      }

      setBookings((prev) =>
        prev
          .map((b) => (b.id === editingBookingId ? (data as ScannerBooking) : b))
          .sort((a, b) => a.start_date.localeCompare(b.start_date)),
      )
      setSaving(false)
      closeBookingForm()
      setSuccessMsg('ההזמנה עודכנה')
      return
    }

    const { data, error: insertError } = await supabase
      .from('scanner_bookings')
      .insert({
        ...payload,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError || !data) {
      if (financeEntryId && !existingFinanceId) {
        await supabase.from('admin_finance_entries').delete().eq('id', financeEntryId)
      }
      if (debtFinanceEntryId && !existingDebtFinanceId) {
        await supabase.from('admin_finance_entries').delete().eq('id', debtFinanceEntryId)
      }
      const msg = insertError?.message ?? 'שגיאה בשמירה'
      setError(
        msg.includes('scanner_bookings_no_overlap') || msg.includes('exclusion')
          ? 'הסורק כבר תפוס בתאריכים האלה'
          : msg.includes('collected_by')
            ? 'יש להריץ את עדכון מסד הנתונים (APPLY_FINANCE_INCOME_ATTRIBUTION.sql)'
            : msg.includes('amount_paid') || msg.includes('debt_finance')
            ? 'יש להריץ את עדכון מסד הנתונים (APPLY_BOOKING_PARTIAL_PAYMENT.sql)'
            : msg.includes('booking_package') || msg.includes('amount') || msg.includes('finance_entry')
              ? 'יש להריץ את עדכון מסד הנתונים (APPLY_BOOKING_PACKAGE_PRICE.sql)'
              : msg,
      )
      setSaving(false)
      return
    }

    setBookings((prev) =>
      [...prev, data as ScannerBooking].sort((a, b) =>
        a.start_date.localeCompare(b.start_date),
      ),
    )
    setSaving(false)
    closeBookingForm()
    if (amount != null && amount > 0) {
      const debt = Math.max(0, amount - amountPaid)
      if (amountPaid > 0 && debt > 0) {
        setSuccessMsg(
          `ההזמנה נשמרה · שולם ${formatPriceIls(amountPaid)} · לא שולם ${formatPriceIls(debt)}`,
        )
      } else if (amountPaid > 0) {
        setSuccessMsg(`ההזמנה נשמרה · שולם`)
      } else {
        setSuccessMsg(`ההזמנה נשמרה · לא שולם`)
      }
    }
  }

  async function confirmResetEventScans() {
    if (!resetEventTarget || resetting) return
    const { eventId, eventName } = resetEventTarget
    setResetting(true)
    setError(null)
    setSuccessMsg(null)
    const { data, error: rpcError } = await supabase.rpc('admin_reset_event_scans', {
      p_event_id: eventId,
    })
    setResetting(false)
    setResetEventTarget(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    const deleted = (data as { deleted_transactions?: number } | null)?.deleted_transactions ?? 0
    setSuccessMsg(`הסריקות אופסו למשחק "${eventName}". נמחקו ${deleted} רשומות ניקוד.`)
  }

  function openEventActions(booking: ScannerBooking) {
    if (!booking.event_id) return
    setEventActionError(null)
    setOfflineExportError(null)
    setEventActionsBooking(booking)
  }

  function closeEventActions() {
    if (updatingEventPlan || exportingOffline || activatingPlan || updatingBarcode) return
    setEventActionsBooking(null)
    setEventActionError(null)
    setOfflineExportError(null)
  }

  async function applyEventPlanChange(eventId: string, newPlan: UserPlan) {
    const { data, error: rpcError } = await supabase.rpc('update_event_plan', {
      p_event_id: eventId,
      p_new_plan: newPlan,
    })
    if (rpcError) return { ok: false as const, error: rpcError.message }

    const result = data as {
      previous_plan?: string
      new_plan?: string
      did_reset?: boolean
      trial_scans_used?: number
    } | null

    setEvents((prev) =>
      prev.map((ev) => (ev.id === eventId ? { ...ev, plan: newPlan } : ev)),
    )

    if (result?.previous_plan === 'free' && result.new_plan && result.new_plan !== 'free') {
      trackTrialActivated(eventId, result.new_plan, result.trial_scans_used ?? 0)
      if (result.did_reset) trackTrialDataReset(eventId)
    }

    return { ok: true as const }
  }

  function requestEventPlanChange(eventId: string, previousPlan: UserPlan, newPlan: UserPlan) {
    if (previousPlan === newPlan) return
    setEventActionError(null)
    if (previousPlan === 'free' && newPlan !== 'free') {
      setPendingPlanChange({ eventId, previousPlan, newPlan })
      return
    }
    void (async () => {
      setUpdatingEventPlan(true)
      const result = await applyEventPlanChange(eventId, newPlan)
      setUpdatingEventPlan(false)
      if (!result.ok) {
        setEventActionError(result.error)
        return
      }
      setSuccessMsg(`תוכנית המשחק עודכנה ל־${eventPlanLabel(newPlan)}`)
    })()
  }

  async function confirmPendingPlanChange() {
    if (!pendingPlanChange) return
    setActivatingPlan(true)
    const { eventId, newPlan } = pendingPlanChange
    setUpdatingEventPlan(true)
    const result = await applyEventPlanChange(eventId, newPlan)
    setUpdatingEventPlan(false)
    setActivatingPlan(false)
    setPendingPlanChange(null)
    if (!result.ok) {
      setEventActionError(result.error)
      return
    }
    setSuccessMsg(`תוכנית המשחק עודכנה ל־${eventPlanLabel(newPlan)}`)
  }

  // Changing symbology invalidates every already-printed card, so the choice is
  // gated behind a confirmation before it touches the event.
  function requestBarcodeChange(eventId: string, currentType: BarcodeType, newType: BarcodeType) {
    if (currentType === newType) return
    setEventActionError(null)
    setPendingBarcodeChange({ eventId, newType })
  }

  async function confirmBarcodeChange() {
    if (!pendingBarcodeChange) return
    const { eventId, newType } = pendingBarcodeChange
    setUpdatingBarcode(true)
    const { error: rpcError } = await supabase.rpc('update_event_barcode_type', {
      p_event_id: eventId,
      p_barcode_type: newType,
    })
    setUpdatingBarcode(false)
    setPendingBarcodeChange(null)
    if (rpcError) {
      setEventActionError(rpcError.message)
      return
    }
    setEvents((prev) =>
      prev.map((ev) => (ev.id === eventId ? { ...ev, barcode_type: newType } : ev)),
    )
    const label = BARCODE_TYPE_OPTIONS.find((o) => o.value === newType)?.label ?? newType
    setSuccessMsg(`סוג הברקוד עודכן ל־${label}. יש להדפיס כרטיסים חדשים.`)
  }

  async function downloadLinkedOfflineGame(eventId: string) {
    setOfflineExportError(null)
    setExportingOffline(true)
    try {
      await exportOfflineGame(eventId)
    } catch (err) {
      setOfflineExportError(
        err instanceof OfflineExportError ? err.message : 'ההורדה נכשלה. נסו שוב.',
      )
    } finally {
      setExportingOffline(false)
    }
  }

  async function submitScanner(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    const name = newName.trim()
    const code = newCode.trim().toUpperCase()
    if (!name || !code) {
      setError('שם וקוד סורק הם שדות חובה')
      return
    }

    setSaving(true)
    setError(null)

    const notes = newNotes.trim() || null

    if (editingScannerId) {
      const { data, error: updateError } = await supabase
        .from('scanners')
        .update({ name, code, notes })
        .eq('id', editingScannerId)
        .select()
        .single()

      if (updateError || !data) {
        setError(
          updateError?.code === '23505'
            ? 'כבר קיים סורק עם הקוד הזה'
            : updateError?.message ?? 'שגיאה בשמירה',
        )
        setSaving(false)
        return
      }

      setScanners((prev) => prev.map((s) => (s.id === editingScannerId ? (data as Scanner) : s)))
      setSaving(false)
      setScannerOpen(false)
      return
    }

    const maxSort = scanners.reduce((m, s) => Math.max(m, s.sort_order), 0)
    const { data, error: insertError } = await supabase
      .from('scanners')
      .insert({
        name,
        code,
        notes,
        sort_order: maxSort + 1,
        status: 'active',
      })
      .select()
      .single()

    if (insertError || !data) {
      setError(
        insertError?.code === '23505'
          ? 'כבר קיים סורק עם הקוד הזה'
          : insertError?.message ?? 'שגיאה בשמירה',
      )
      setSaving(false)
      return
    }

    setScanners((prev) => [...prev, data as Scanner])
    setSaving(false)
    setScannerOpen(false)
  }

  async function confirmDeleteBooking() {
    if (!deleteBookingId || deleting) return
    setDeleting(true)
    const prev = bookings
    const target = bookings.find((b) => b.id === deleteBookingId)
    const financeId = target?.finance_entry_id ?? null
    const debtFinanceId = target?.debt_finance_entry_id ?? null
    setBookings((items) => items.filter((b) => b.id !== deleteBookingId))
    const { error: delError } = await supabase
      .from('scanner_bookings')
      .delete()
      .eq('id', deleteBookingId)
    if (delError) {
      setBookings(prev)
      setError(delError.message)
      setDeleteBookingId(null)
      setDeleting(false)
      return
    }
    if (financeId) {
      await supabase.from('admin_finance_entries').delete().eq('id', financeId)
    }
    if (debtFinanceId) {
      await supabase.from('admin_finance_entries').delete().eq('id', debtFinanceId)
    }
    setDeleteBookingId(null)
    setDeleting(false)
  }

  if (loading) return <CenteredLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {scanners.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openEditScanner(s)}
              title={s.notes ? `${s.notes} · לחיצה לעריכה` : 'לחיצה לעריכה'}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs transition hover:border-secondary/40 hover:bg-surface-elevated',
                s.status === 'retired' && 'opacity-50',
                s.status === 'maintenance' && 'border-warning/40',
              )}
            >
              <span
                className={cn('h-2.5 w-2.5 rounded-full', colorForScanner(scanners, s.id))}
              />
              <span className="font-medium text-foreground">{s.name}</span>
              <span className="text-muted">{s.code}</span>
              {s.status === 'maintenance' && (
                <span className="text-warning-text">תחזוקה</span>
              )}
              <Pencil size={11} className="text-muted" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openAddScanner}>
            <Plus size={14} className="ml-1" />
            סורק חדש
          </Button>
          <Button size="sm" onClick={() => openBooking()}>
            <CalendarPlus size={14} className="ml-1" />
            הזמנה חדשה
          </Button>
        </div>
      </div>

      {/* One board: scanners x the visible window.
          This replaced a month grid that sat above it and answered the same
          questions in less room - so the day columns get the whole width now,
          and the grid's two useful extras (free-scanner counts, double-click
          to book) moved down here rather than being lost with it. */}
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">לוח תפוסה</h3>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWindowStart((d) => addDays(d, -PAGE_DAYS))}
              className="rounded-lg border border-border p-2 text-muted hover:border-secondary/40 hover:text-foreground"
              aria-label="אחורה שלושה שבועות"
            >
              <ChevronRight size={16} />
            </button>
            <div className="min-w-[9rem] text-center">
              <p className="text-sm font-semibold text-foreground">{rangeLabel}</p>
              <p className="text-[11px] tabular-nums text-muted">
                {format(windowStart, 'd.M')} – {format(windowEnd, 'd.M')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWindowStart((d) => addDays(d, PAGE_DAYS))}
              className="rounded-lg border border-border p-2 text-muted hover:border-secondary/40 hover:text-foreground"
              aria-label="קדימה שלושה שבועות"
            >
              <ChevronLeft size={16} />
            </button>
            {!todayInWindow && (
              <button
                type="button"
                onClick={() => setWindowStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
                className="rounded-lg border border-border px-2.5 py-2 text-[11px] font-medium text-muted hover:border-secondary/40 hover:text-foreground"
              >
                היום
              </button>
            )}
          </div>
        </div>

        {activeScanners.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">אין סורקים עדיין. הוסף סורק חדש.</p>
        ) : (
          <div className="overflow-x-auto">
          <div className="relative min-w-[1900px]">
            <div className="space-y-1.5">
              {/* The window crosses a month boundary, so name the months above
                  the numbers - otherwise the row reads "30 31 1 2" with no clue. */}
              <div className="grid gap-0.5" style={{ gridTemplateColumns: boardColumns }}>
                <div className="sticky start-0 z-20 border-e border-border/60 bg-surface" />
                {monthBands.map((band) => (
                  <div
                    key={band.key}
                    className="truncate border-b border-border/60 pb-1 text-center text-[11px] font-bold text-muted"
                    style={{ gridColumn: `span ${band.span}` }}
                  >
                    {band.label}
                  </div>
                ))}
              </div>

              <div className="grid gap-0.5" style={{ gridTemplateColumns: boardColumns }}>
                <div className="sticky start-0 z-20 border-e border-border/60 bg-surface" />
                {windowDays.map((d) => {
                  const isToday = isSameDay(d, new Date())
                  return (
                    <div
                      key={d.toISOString()}
                      className={cn(
                        'rounded-md py-1 text-center leading-tight',
                        d.getDay() === 6 && !isToday && 'bg-surface-elevated/70',
                        isToday && 'bg-secondary',
                        isPastDay(d) && !isToday && 'opacity-45',
                      )}
                    >
                      <span
                        className={cn('block text-[9px]', isToday ? 'text-white/80' : 'text-muted/70')}
                      >
                        {WEEKDAY_LABELS[d.getDay()]}
                      </span>
                      <span
                        className={cn(
                          'block text-[13px] font-semibold tabular-nums',
                          isToday ? 'text-white' : 'text-foreground',
                        )}
                      >
                        {format(d, 'd')}
                      </span>
                    </div>
                  )
                })}
              </div>

              {[
                ...activeScanners.map((scanner) => ({
                  key: scanner.id,
                  label: scanner.name,
                  color: colorForScanner(scanners, scanner.id),
                  rowBookings: bookings.filter((b) => b.scanner_id === scanner.id),
                })),
                {
                  key: '__none__',
                  label: 'ללא סורק',
                  color: 'bg-muted',
                  rowBookings: bookings.filter((b) => !b.scanner_id),
                },
              ].map((row) => {
                const spans = row.rowBookings
                  .map((booking) => {
                    const span = bookingSpanInDays(booking, windowDays)
                    return span ? { booking, ...span } : null
                  })
                  .filter((x): x is { booking: ScannerBooking; start: number; span: number } => x != null)

                if (row.key === '__none__' && spans.length === 0) return null

                return (
                  <div
                    key={row.key}
                    className="grid gap-0.5"
                    style={{ gridTemplateColumns: boardColumns }}
                  >
                    <div className="sticky start-0 z-20 border-e border-border/60 bg-surface flex items-center gap-2 truncate pe-2 text-sm text-foreground">
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', row.color)} />
                      <span className="truncate font-medium">{row.label}</span>
                    </div>
                    {windowDays.map((d, dayIdx) => {
                      const occupied = spans.some(
                        (s) => dayIdx >= s.start && dayIdx < s.start + s.span,
                      )
                      return (
                        <button
                          key={d.toISOString()}
                          type="button"
                          onClick={() => openDayDetail(d)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            openBooking(d)
                          }}
                          className={cn(
                            'row-start-1 h-11 rounded-md border border-border/40 bg-surface-elevated/50',
                            'transition-colors hover:bg-secondary/10',
                            isPastDay(d) && 'bg-surface-elevated/20',
                          )}
                          style={{ gridColumn: dayIdx + 2 }}
                          title={occupied ? 'לחיצה לפרטי היום' : 'פנוי - לחיצה לפרטי היום'}
                          aria-label={`${format(d, 'd/M')}${occupied ? '' : ' פנוי'}`}
                        />
                      )
                    })}
                    {spans.map(({ booking, start, span }) => {
                      const colors = colorForFamily(familyColors, booking.customer_name)
                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => openBookingDetail(booking)}
                          title={`${booking.customer_name} · ${formatRange(booking.start_date, booking.end_date)}`}
                          className="z-10 row-start-1 my-0.5 flex items-center overflow-hidden rounded-md px-1 text-start text-[11px] font-semibold shadow-sm transition-opacity hover:opacity-90"
                          style={{
                            gridColumn: `${start + 2} / span ${span}`,
                            backgroundColor: colors.bg,
                            color: colors.text,
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">{booking.customer_name}</span>
                          <OutstandingDot state={bookingPaymentState(booking)} />
                        </button>
                      )
                    })}
                  </div>
                )
              })}

              {/* Free-scanner count per day - the one number the month grid
                  showed that a wall of bars cannot: capacity still to sell. */}
              <div
                className="grid gap-0.5 border-t border-border/50 pt-1.5"
                style={{ gridTemplateColumns: boardColumns }}
              >
                <div className="sticky start-0 z-20 border-e border-border/60 bg-surface truncate pe-2 text-xs font-medium text-muted">
                  סורקים פנויים
                </div>
                {windowDays.map((d, i) => {
                  const cap = capacityByDay[i]
                  if (cap.total === 0 || isPastDay(d)) return <div key={d.toISOString()} />
                  return (
                    <div
                      key={d.toISOString()}
                      title={`${cap.free} פנויים מתוך ${cap.total}`}
                      className={cn(
                        'rounded py-0.5 text-center text-[11px] font-bold tabular-nums',
                        cap.free === 0
                          ? 'bg-danger/15 text-danger-text'
                          : cap.free === cap.total
                            ? 'bg-success/15 text-success-text'
                            : 'bg-warning/15 text-warning-text',
                      )}
                    >
                      {cap.free}/{cap.total}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Week rulers: one line after every Saturday, plus a tint down
                today - drawn over the rows as a single overlay so each reads
                as one stripe rather than a tick that restarts per scanner. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 grid gap-0.5"
              style={{ gridTemplateColumns: boardColumns }}
            >
              <div />
              {windowDays.map((d, i) => (
                <div
                  key={d.toISOString()}
                  className={cn(
                    i > 0 && i % 7 === 0 && 'border-s-2 border-s-border-strong',
                    isSameDay(d, new Date()) && 'bg-secondary/[0.07]',
                  )}
                />
              ))}
            </div>
          </div>
          </div>
        )}

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          <span>לחיצה על יום פותחת את כל הפרטים · לחיצה כפולה פותחת הזמנה חדשה ליום הזה · רצועה צבעונית = משפחה לכמה ימים</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full ring-1 ring-white/85" style={{ backgroundColor: UNPAID_DOT }} />
            לא שולם
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full ring-1 ring-white/85" style={{ backgroundColor: PARTIAL_DOT }} />
            שולם חלקית
          </span>
        </p>
      </Card>

      <Modal
        isOpen={!!selectedDay}
        onClose={closeDetail}
        title={
          selectedDay
            ? format(selectedDay, 'EEEE, d בMMMM yyyy', { locale: he })
            : 'פרטי יום'
        }
        dialogClassName="max-w-lg max-h-[min(90vh,44rem)]"
        contentClassName="overflow-y-auto overscroll-contain"
      >
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selectedDay) openBooking(selectedDay)
              }}
            >
              <Plus size={14} className="ml-1" />
              הזמנה ליום זה
            </Button>
          </div>
          {selectedDayBookings.length === 0 ? (
            <p className="text-sm text-muted">אין הזמנות ביום זה - כל הסורקים הפעילים פנויים.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayBookings.map((b) => (
                <BookingDetailCard
                  key={b.id}
                  booking={b}
                  familyColors={familyColors}
                  scannerLabel={scannerLabel(b.scanner_id)}
                  eventLabel={eventLabel(b.event_id)}
                  packageLabel={packageLabel(b.booking_package)}
                  collectorLabel={adminLabel(admins, b.collected_by)}
                  onEdit={() => openEditBooking(b)}
                  onDelete={() => {
                    closeDetail()
                    setDeleteBookingId(b.id)
                  }}
                  onEventActions={b.event_id ? () => openEventActions(b) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!selectedBooking}
        onClose={closeDetail}
        title={selectedBooking?.customer_name ?? 'פרטי הזמנה'}
        dialogClassName="max-w-lg"
      >
        {selectedBooking && (
          <BookingDetailCard
            booking={selectedBooking}
            familyColors={familyColors}
            scannerLabel={scannerLabel(selectedBooking.scanner_id)}
            eventLabel={eventLabel(selectedBooking.event_id)}
            packageLabel={packageLabel(selectedBooking.booking_package)}
            collectorLabel={adminLabel(admins, selectedBooking.collected_by)}
            onEdit={() => openEditBooking(selectedBooking)}
            onDelete={() => {
              const id = selectedBooking.id
              closeDetail()
              setDeleteBookingId(id)
            }}
            onEventActions={
              selectedBooking.event_id
                ? () => openEventActions(selectedBooking)
                : undefined
            }
          />
        )}
      </Modal>

      {error && !bookingOpen && !scannerOpen && !eventActionsBooking && (
        <p className="text-sm text-danger-text">{error}</p>
      )}
      {successMsg && !bookingOpen && !scannerOpen && (
        <p className="text-sm text-success-text">{successMsg}</p>
      )}

      <Modal
        isOpen={bookingOpen}
        onClose={closeBookingForm}
        title={editingBookingId ? 'עריכת הזמנה' : 'הזמנה חדשה'}
        dialogClassName="max-w-md"
      >
        <form onSubmit={submitBooking} className="space-y-3">
          <Select
            id="booking-package"
            label="חבילה"
            value={formPackage}
            onChange={(e) => {
              setAutoPrice(true)
              setFormPackage(e.target.value as BookablePackage | '')
            }}
            required
          >
            <option value="" disabled>
              בחרי חבילה…
            </option>
            {BOOKABLE_PACKAGES.map((pkg) => {
              const base = planBasePrice(pkg)
              const suffix =
                base == null
                  ? ' - מחיר לפי הסכם'
                  : pkg === 'full' || pkg === 'offline'
                    ? ` - מ-${formatPriceIls(base)} (+${formatPriceIls(EXTRA_DAY_PRICE)} ליום נוסף)`
                    : ` - ${formatPriceIls(base)}`
              return (
                <option key={pkg} value={pkg}>
                  {BOOKING_PACKAGE_LABELS[pkg]}
                  {suffix}
                </option>
              )
            })}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="booking-start"
              label="מתאריך"
              type="date"
              value={formStart}
              onChange={(e) => {
                setAutoPrice(true)
                setFormStart(e.target.value)
              }}
              required
            />
            <Input
              id="booking-end"
              label="עד תאריך"
              type="date"
              value={formEnd}
              onChange={(e) => {
                setAutoPrice(true)
                setFormEnd(e.target.value)
              }}
              required
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-end gap-3" dir="rtl">
              <div className="min-w-0 flex-1">
                <Input
                  id="booking-amount"
                  label="מחיר (₪)"
                  type="number"
                  min={0}
                  step="1"
                  value={formAmount}
                  onChange={(e) => {
                    setAutoPrice(false)
                    setFormAmount(e.target.value)
                    if (formPaid && !formAmountPaid.trim()) {
                      setFormAmountPaid(e.target.value)
                    }
                  }}
                  placeholder={suggestedPrice != null ? String(suggestedPrice) : 'הזיני מחיר'}
                />
              </div>
              <div className="shrink-0 pb-2.5">
                <Checkbox
                  id="booking-paid"
                  label="שולם"
                  checked={formPaid}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setFormPaid(checked)
                    if (checked) {
                      setFormAmountPaid((prev) => prev.trim() || formAmount)
                      // Money just came in - default the collector so it can be attributed.
                      setFormCollectedBy((prev) => prev || defaultCollector())
                    } else {
                      setFormAmountPaid('')
                      // Nothing paid means we don't yet know whose hands it lands in.
                      setFormCollectedBy('')
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-0.5 text-[11px] text-muted">
              {formPackage && suggestedPrice != null ? (
                <span>
                  חישוב אוטומטי: {formatPriceIls(suggestedPrice)}
                  {(formPackage === 'full' || formPackage === 'offline') &&
                    ` · ${bookingDayCount(formStart, formEnd)} ימים`}
                  {!autoPrice &&
                    formAmount.trim() !== '' &&
                    Number(formAmount) !== suggestedPrice &&
                    ' · עודכן ידנית'}
                </span>
              ) : formPackage === 'organizations' ? (
                <span>לחבילת ארגונים הזיני מחיר ידנית</span>
              ) : (
                <span>בחרי חבילה ותאריכים לחישוב מחיר</span>
              )}
              {suggestedPrice != null && !autoPrice && (
                <button
                  type="button"
                  className="text-start text-secondary-text hover:underline"
                  onClick={() => setAutoPrice(true)}
                >
                  חשב מחדש לפי חבילה ותאריכים
                </button>
              )}
            </div>
            {formPaid && (
              <div className="space-y-1 pt-1">
                <Input
                  id="booking-amount-paid"
                  label="כמה שולם (₪)"
                  type="number"
                  min={0}
                  step="1"
                  value={formAmountPaid}
                  onChange={(e) => setFormAmountPaid(e.target.value)}
                  placeholder={formAmount || '0'}
                />
                {(() => {
                  const total = Number(formAmount)
                  const paid = formAmountPaid.trim() === '' ? total : Number(formAmountPaid)
                  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(paid)) return null
                  const debt = Math.max(0, total - paid)
                  if (debt <= 0) {
                    return <p className="text-[11px] text-muted">שולם</p>
                  }
                  return (
                    <p className="text-[11px] text-muted">
                      לא שולם: {formatPriceIls(debt)}
                    </p>
                  )
                })()}
              </div>
            )}
          </div>
          {/* Only a paid (or part-paid) booking has money that landed somewhere;
              until then there is nothing to attribute, so the field is hidden. */}
          {admins.length > 0 && formPaid && (
            <div className="space-y-1">
              <Select
                id="booking-collected-by"
                label="הכסף נכנס ל"
                value={formCollectedBy}
                onChange={(e) => setFormCollectedBy(e.target.value)}
              >
                <option value="">ללא שיוך</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name || a.email}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-muted">
                {formCollectedBy
                  ? 'ההכנסה (וגם חוב שנשאר) תשויך לאדמין הזה בדף הכנסות והוצאות'
                  : 'בלי שיוך לא נדע איך לחלק את הכסף - מומלץ לבחור'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="booking-event-link" className="block text-sm font-medium text-foreground">
              משחק מקושר (אופציונלי)
            </label>
            {selectedLinkEvent ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated/40 px-3 py-2">
                <div className="min-w-0 flex-1 text-sm text-foreground">
                  <span className="font-medium">{eventLinkCustomerLabel(selectedLinkEvent)}</span>
                  <span className="text-muted"> · </span>
                  <span>{eventLinkGameLabel(selectedLinkEvent)}</span>
                </div>
                <button
                  type="button"
                  onClick={clearLinkedEvent}
                  className="shrink-0 rounded-lg p-1 text-muted hover:bg-surface hover:text-foreground"
                  title="הסר קישור למשחק"
                  aria-label="הסר קישור למשחק"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  id="booking-event-link"
                  type="search"
                  value={eventLinkQuery}
                  onChange={(e) => {
                    setEventLinkQuery(e.target.value)
                    setEventLinkOpen(true)
                  }}
                  onFocus={() => setEventLinkOpen(true)}
                  onBlur={() => {
                    // Allow click on an option before closing.
                    window.setTimeout(() => setEventLinkOpen(false), 150)
                  }}
                  placeholder="חיפוש לפי לקוח, אימייל או שם נופש..."
                  aria-label="חיפוש משחק מקושר"
                  autoComplete="off"
                  className="w-full rounded-xl border border-border bg-background py-2 pe-3 ps-9 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                {eventLinkOpen && (
                  <ul
                    className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-modal py-1 shadow-lg"
                    role="listbox"
                  >
                    {filteredLinkEvents.length === 0 ? (
                      <li className="px-3 py-2 text-xs text-muted">לא נמצאו תוצאות</li>
                    ) : (
                      filteredLinkEvents.map((ev) => (
                        <li key={ev.id}>
                          <button
                            type="button"
                            role="option"
                            className="flex w-full flex-col items-stretch gap-0.5 px-3 py-2 text-start hover:bg-surface-elevated"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectLinkedEvent(ev)}
                          >
                            <span className="truncate text-sm font-medium text-foreground">
                              {eventLinkCustomerLabel(ev)}
                            </span>
                            <span className="truncate text-xs text-muted">
                              {eventLinkGameLabel(ev)}
                              {ev.owner_email && ev.owner_name.trim()
                                ? ` · ${ev.owner_email}`
                                : ''}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
          <Select
            id="booking-scanner"
            label="סורק (אופציונלי)"
            value={formScannerId}
            onChange={(e) => setFormScannerId(e.target.value)}
          >
            <option value="">ללא סורק</option>
            {activeScanners.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.status === 'maintenance' ? ' - תחזוקה' : ''}
              </option>
            ))}
          </Select>
          <Input
            id="booking-customer"
            label="שם לקוח / משפחה"
            value={formCustomer}
            onChange={(e) => setFormCustomer(e.target.value)}
            placeholder="למשל: משפחת כהן"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="booking-phone"
              label="טלפון"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
            />
            <Input
              id="booking-email"
              label="אימייל"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
            />
          </div>
          <Input
            id="booking-notes"
            label="הערות"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
          {error && <p className="text-sm text-danger-text">{error}</p>}
          <ModalActions>
            <Button type="submit" loading={saving}>
              {editingBookingId ? 'שמור שינויים' : 'שמור הזמנה'}
            </Button>
            <Button type="button" variant="outline" onClick={closeBookingForm}>
              ביטול
            </Button>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title={editingScannerId ? 'עריכת סורק' : 'הוספת סורק'}
        dialogClassName="max-w-md"
      >
        <form onSubmit={submitScanner} className="space-y-3">
          <Input
            id="scanner-name"
            label="שם"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <Input
            id="scanner-code"
            label="קוד מזהה"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="SCAN-04"
            required
          />
          <Input
            id="scanner-notes"
            label="תיאור / הערות"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="למשל: הסורק הכחול, נמצא במשרד"
          />
          {error && <p className="text-sm text-danger-text">{error}</p>}
          <ModalActions>
            <Button type="submit" loading={saving}>
              {editingScannerId ? 'שמור שינויים' : 'הוסף סורק'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setScannerOpen(false)}>
              ביטול
            </Button>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        isOpen={!!eventActionsBooking}
        onClose={closeEventActions}
        title="פעולות על האירוע"
        dialogClassName="max-w-md"
      >
        {eventActionsBooking?.event_id && (() => {
          const eventId = eventActionsBooking.event_id
          const linked = eventById.get(eventId)
          const currentPlan = (linked?.plan ?? 'free') as UserPlan
          const currentBarcodeType: BarcodeType = linked?.barcode_type ?? 'qr'
          const extras = summariseOverrides(
            featureCatalog,
            currentPlan,
            featureOverrides[eventId] ?? [],
          )
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface px-3 py-3 text-sm">
                <p className="font-medium text-foreground">
                  {eventLabel(eventId)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {eventActionsBooking.customer_name}
                  {linked?.owner_email ? ` · ${linked.owner_email}` : ''}
                </p>
                <p className="mt-1 text-xs text-muted">
                  תוכנית נוכחית: {eventPlanLabel(currentPlan)}
                  {extras.granted > 0 && ` · ${extras.granted} תוספות`}
                  {extras.withheld > 0 && ` · ${extras.withheld} הוסרו`}
                </p>
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-foreground">סוג ברקוד</span>
                <div role="radiogroup" aria-label="סוג ברקוד" className="grid grid-cols-2 gap-2">
                  {BARCODE_TYPE_OPTIONS.map((opt) => {
                    const isSelected = currentBarcodeType === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={updatingBarcode}
                        onClick={() => requestBarcodeChange(eventId, currentBarcodeType, opt.value)}
                        className={cn(
                          'rounded-xl border p-2.5 text-center transition-colors disabled:opacity-60',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-surface hover:bg-surface-elevated',
                        )}
                      >
                        <span className="block text-sm font-semibold text-foreground">{opt.label}</span>
                        <span className="mt-0.5 block text-[11px] text-muted">{opt.hint}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  שינוי הסוג מצריך הדפסת כרטיסים חדשים.
                </p>
              </div>

              <Select
                id="event-actions-plan"
                label="שדרוג תוכנית"
                value={currentPlan}
                disabled={updatingEventPlan || activatingPlan}
                onChange={(e) =>
                  requestEventPlanChange(eventId, currentPlan, e.target.value as UserPlan)
                }
              >
                {EVENT_PLAN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>

              {currentPlan === 'offline' && (
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    loading={exportingOffline}
                    onClick={() => void downloadLinkedOfflineGame(eventId)}
                    title="הורידו את קובץ המשחק ושלחו אותו ללקוח"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Download size={14} />
                      הורד קובץ אופליין
                    </span>
                  </Button>
                  {offlineExportError && (
                    <p role="alert" className="text-xs font-semibold text-danger-text">
                      {offlineExportError}
                    </p>
                  )}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setFeaturesTarget({ eventId, plan: currentPlan })}
                title="הוסיפו או הסירו פיצ׳ר פלאג למשחק הזה בלבד"
              >
                <SlidersHorizontal size={14} className="ml-1" />
                פיצ׳ר פלאגים של המשחק
                {extras.granted > 0 && (
                  <span className="mr-1.5 text-xs font-semibold text-success-text">
                    +{extras.granted}
                  </span>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setResetEventTarget({
                    eventId,
                    eventName: eventLabel(eventId),
                  })
                }}
              >
                <RotateCcw size={14} className="ml-1" />
                איפוס סריקות למשחק
              </Button>

              {eventActionError && (
                <p className="text-sm text-danger-text">{eventActionError}</p>
              )}

              <ModalActions>
                <Button type="button" variant="outline" onClick={closeEventActions}>
                  סגור
                </Button>
              </ModalActions>
            </div>
          )
        })()}
      </Modal>

      <EventFeaturesModal
        isOpen={!!featuresTarget}
        onClose={() => setFeaturesTarget(null)}
        eventId={featuresTarget?.eventId ?? ''}
        eventName={featuresTarget ? eventLabel(featuresTarget.eventId) : ''}
        plan={featuresTarget?.plan ?? 'free'}
        onChanged={() => void refreshFeatureOverrides()}
      />

      <TrialActivationResetModal
        isOpen={pendingPlanChange !== null}
        onClose={() => {
          if (!activatingPlan) setPendingPlanChange(null)
        }}
        onContinue={() => void confirmPendingPlanChange()}
        loading={activatingPlan}
      />

      <ConfirmModal
        isOpen={pendingBarcodeChange !== null}
        onClose={() => {
          if (!updatingBarcode) setPendingBarcodeChange(null)
        }}
        onConfirm={() => void confirmBarcodeChange()}
        title="שינוי סוג הברקוד"
        description="שינוי סוג הברקוד ידרוש הדפסת כרטיסים חדשים — הכרטיסים שכבר הודפסו לא יתאימו לסורק. להמשיך?"
        confirmLabel="שנה סוג והמשך"
        loading={updatingBarcode}
      />

      <ConfirmModal
        isOpen={!!deleteBookingId}
        onClose={() => setDeleteBookingId(null)}
        onConfirm={confirmDeleteBooking}
        title="מחיקת הזמנה"
        description="למחוק את ההזמנה? סורק משויך יהיה פנוי שוב."
        confirmLabel="מחק"
        loading={deleting}
      />

      <ConfirmModal
        isOpen={!!resetEventTarget}
        onClose={() => setResetEventTarget(null)}
        onConfirm={confirmResetEventScans}
        title="איפוס סריקות למשחק"
        description={
          resetEventTarget
            ? `לאפס את כל הסריקות, הניקוד והפרסים שנצברו במשחק "${resetEventTarget.eventName}"? פעולה זו לא ניתנת לביטול.`
            : ''
        }
        confirmLabel="אפס סריקות"
        loading={resetting}
      />
    </div>
  )
}

function BookingDetailCard({
  booking,
  familyColors,
  scannerLabel,
  eventLabel,
  packageLabel,
  collectorLabel,
  onEdit,
  onDelete,
  onEventActions,
}: {
  booking: ScannerBooking
  familyColors: Map<string, FamilyColor>
  scannerLabel: string
  eventLabel: string
  packageLabel: string
  collectorLabel: string
  onEdit: () => void
  onDelete: () => void
  onEventActions?: () => void
}) {
  const payState = bookingPaymentState(booking)
  const rows: { label: string; value: string; tone?: 'danger' | 'warning' }[] = [
    { label: 'משפחה / לקוח', value: booking.customer_name },
    { label: 'חבילה', value: packageLabel },
    {
      label: 'מחיר',
      value: booking.amount != null ? formatPriceIls(Number(booking.amount)) : '-',
    },
    {
      label: 'תשלום',
      tone: payState === 'unpaid' ? 'danger' : payState === 'partial' ? 'warning' : undefined,
      value: (() => {
        const total = booking.amount != null ? Number(booking.amount) : null
        const paid =
          booking.amount_paid != null
            ? Number(booking.amount_paid)
            : booking.is_paid && total != null
              ? total
              : 0
        if (paid <= 0) return 'לא שולם'
        if (total != null && paid < total) {
          return `שולם ${formatPriceIls(paid)} · לא שולם ${formatPriceIls(total - paid)}`
        }
        return paid > 0 && total != null && paid >= total
          ? 'שולם'
          : `שולם ${formatPriceIls(paid)}`
      })(),
    },
    // Only meaningful once money has actually come in; an unpaid booking has
    // no destination yet, so the row is left out entirely.
    ...(payState === 'paid' || payState === 'partial'
      ? [{ label: 'הכסף נכנס ל', value: collectorLabel }]
      : []),
    { label: 'משחק', value: eventLabel },
    { label: 'סורק', value: scannerLabel },
    { label: 'תאריכים', value: formatRange(booking.start_date, booking.end_date) },
  ]
  if (booking.customer_phone) rows.push({ label: 'טלפון', value: booking.customer_phone })
  if (booking.customer_email) rows.push({ label: 'אימייל', value: booking.customer_email })
  if (booking.notes) rows.push({ label: 'הערות', value: booking.notes })

  const familyColor = colorForFamily(familyColors, booking.customer_name)

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg px-3 py-2 text-sm font-semibold"
        style={{ backgroundColor: familyColor.bg, color: familyColor.text }}
      >
        {booking.customer_name}
      </div>
      <dl className="space-y-2 rounded-xl border border-border bg-surface px-3 py-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
            <dt className="text-muted">{row.label}</dt>
            <dd
              className={cn(
                'break-words font-medium text-foreground',
                row.tone === 'danger' && 'font-bold text-danger-text',
                row.tone === 'warning' && 'font-bold text-warning-text',
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-end gap-2">
        {onEventActions && (
          <Button type="button" variant="outline" size="sm" onClick={onEventActions}>
            <Sparkles size={14} className="ml-1" />
            פעולות על האירוע
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil size={14} className="ml-1" />
          עריכה
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDelete}>
          <Trash2 size={14} className="ml-1" />
          מחק הזמנה
        </Button>
      </div>
    </div>
  )
}
