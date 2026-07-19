import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CalendarPlus,
  RotateCcw,
  Pencil,
} from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { he } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { fetchTemplateDraftEventIds } from '@/lib/templates'
import {
  BOOKABLE_PACKAGES,
  BOOKING_PACKAGE_LABELS,
  EXTRA_DAY_PRICE,
  PLAN_BASE_PRICES,
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
import { cn } from '@/lib/utils'
import type { BookingPackage, Scanner, ScannerBooking } from '@/types'

type EventOption = {
  id: string
  name: string
  plan: string
  status: string
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

/** High-contrast family bar colors (inline styles — reliable on calendar overlays). */
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

function colorForFamily(customerName: string): { bg: string; text: string } {
  return FAMILY_BAR_PALETTE[hashString(customerName.trim()) % FAMILY_BAR_PALETTE.length]
}

function chunkWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

function dayISO(day: Date): string {
  return format(day, 'yyyy-MM-dd')
}

/** Clip a booking into a week row and return 0-based start column + span. */
function bookingSpanInWeek(
  booking: ScannerBooking,
  week: Date[],
): { start: number; span: number } | null {
  const wStart = dayISO(week[0])
  const wEnd = dayISO(week[6])
  if (booking.end_date < wStart || booking.start_date > wEnd) return null
  const clipStart = booking.start_date < wStart ? wStart : booking.start_date
  const clipEnd = booking.end_date > wEnd ? wEnd : booking.end_date
  const start = week.findIndex((d) => dayISO(d) === clipStart)
  const end = week.findIndex((d) => dayISO(d) === clipEnd)
  if (start < 0 || end < 0) return null
  return { start, span: end - start + 1 }
}

type WeekBar = {
  booking: ScannerBooking
  start: number
  span: number
  lane: number
}

function rangesOverlapCols(
  aStart: number,
  aSpan: number,
  bStart: number,
  bSpan: number,
): boolean {
  return aStart < bStart + bSpan && bStart < aStart + aSpan
}

/** Pack overlapping family bars into separate lanes within a week. */
function layoutWeekBookings(bookings: ScannerBooking[], week: Date[]): WeekBar[] {
  const items = bookings
    .map((booking) => {
      const span = bookingSpanInWeek(booking, week)
      return span ? { booking, ...span } : null
    })
    .filter((x): x is { booking: ScannerBooking; start: number; span: number } => x != null)
    .sort(
      (a, b) =>
        a.start - b.start ||
        b.span - a.span ||
        a.booking.customer_name.localeCompare(b.booking.customer_name, 'he'),
    )

  const placed: WeekBar[] = []
  for (const item of items) {
    const used = new Set(
      placed
        .filter((p) => rangesOverlapCols(item.start, item.span, p.start, p.span))
        .map((p) => p.lane),
    )
    let lane = 0
    while (used.has(lane)) lane += 1
    placed.push({ ...item, lane })
  }
  return placed
}

/** Clip a booking to a month day list for the scanner timeline. */
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
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

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

  // booking form
  const [formScannerId, setFormScannerId] = useState('')
  const [formEventId, setFormEventId] = useState('')
  const [formPackage, setFormPackage] = useState<BookablePackage | ''>('')
  const [formAmount, setFormAmount] = useState('')
  const [formPaid, setFormPaid] = useState(false)
  const [formStart, setFormStart] = useState(todayISO)
  const [formEnd, setFormEnd] = useState(todayISO)
  const [formCustomer, setFormCustomer] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // scanner form
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newNotes, setNewNotes] = useState('')

  useEffect(() => {
    async function fetchData() {
      const [scannersRes, bookingsRes, eventsRes, draftIds] = await Promise.all([
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
          .select('id, name, plan, status')
          .neq('status', 'archived')
          .order('created_at', { ascending: false }),
        fetchTemplateDraftEventIds(),
      ])

      if (scannersRes.error) setError(scannersRes.error.message)
      else setScanners((scannersRes.data as Scanner[]) ?? [])

      if (bookingsRes.error) setError(bookingsRes.error.message)
      else setBookings((bookingsRes.data as ScannerBooking[]) ?? [])

      if (eventsRes.error) setError(eventsRes.error.message)
      else {
        const draftSet = new Set(draftIds)
        setEvents(
          ((eventsRes.data as EventOption[]) ?? []).filter((e) => !draftSet.has(e.id)),
        )
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  const activeScanners = useMemo(
    () => scanners.filter((s) => s.status !== 'retired'),
    [scanners],
  )

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const monthBookings = useMemo(() => {
    const mStart = format(startOfMonth(month), 'yyyy-MM-dd')
    const mEnd = format(endOfMonth(month), 'yyyy-MM-dd')
    return bookings.filter((b) => rangesOverlap(b.start_date, b.end_date, mStart, mEnd))
  }, [bookings, month])

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of events) map.set(e.id, e.name?.trim() || 'משחק ללא שם')
    return map
  }, [events])

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

  const calendarWeeks = useMemo(() => chunkWeeks(calendarDays), [calendarDays])

  const daysInMonth = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(month),
        end: endOfMonth(month),
      }),
    [month],
  )

  function scannerLabel(id: string | null): string {
    if (!id) return 'ללא סורק'
    const s = scanners.find((x) => x.id === id)
    return s ? `${s.name} (${s.code})` : 'סורק'
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

  function closeBookingForm() {
    setBookingOpen(false)
    setEditingBookingId(null)
    setAutoPrice(true)
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
    setFormPackage('full')
    setFormAmount(String(calculateBookingPrice('full', iso, iso) ?? 150))
    setFormPaid(false)
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
    setFormPackage((booking.booking_package as BookablePackage | null) ?? 'full')
    setFormAmount(booking.amount != null ? String(booking.amount) : '')
    setFormPaid(booking.is_paid ?? false)
    setError(null)
    closeDetail()
    setBookingOpen(true)
  }

  function packageLabel(pkg: string | null | undefined): string {
    if (!pkg) return 'ללא חבילה'
    return BOOKING_PACKAGE_LABELS[pkg as BookablePackage] ?? pkg
  }

  function onFormEventChange(eventId: string) {
    setFormEventId(eventId)
    if (!formCustomer.trim() && eventId) {
      const name = eventNameById.get(eventId)
      if (name) setFormCustomer(name)
    }
  }

  function openAddScanner() {
    const nextNum = scanners.length + 1
    setNewName(`סורק ${nextNum}`)
    setNewCode(`SCAN-${String(nextNum).padStart(2, '0')}`)
    setNewNotes('')
    setError(null)
    setScannerOpen(true)
  }

  async function syncBookingFinance(options: {
    existingFinanceId: string | null
    amount: number | null
    customer: string
    pkg: BookablePackage
    isPaid: boolean
  }): Promise<{ financeEntryId: string | null; error: string | null }> {
    const { existingFinanceId, amount, customer, pkg, isPaid } = options
    const pkgLabel = BOOKING_PACKAGE_LABELS[pkg]
    const description = `הזמנה: ${customer} · ${pkgLabel} · ${formatRange(formStart, formEnd)}`
    const entryType = isPaid ? 'income' : 'future_income'

    if (amount != null && amount > 0) {
      if (existingFinanceId) {
        const { error: financeError } = await supabase
          .from('admin_finance_entries')
          .update({
            entry_type: entryType,
            amount,
            description,
            entry_date: formStart,
          })
          .eq('id', existingFinanceId)
        if (financeError) {
          const msg = financeError.message ?? ''
          return {
            financeEntryId: null,
            error:
              msg.includes('entry_type') || msg.includes('check')
                ? 'יש להריץ את עדכון מסד הנתונים (APPLY_BOOKING_PAID_FUTURE_INCOME.sql)'
                : msg,
          }
        }
        return { financeEntryId: existingFinanceId, error: null }
      }

      if (!user) return { financeEntryId: null, error: 'יש להתחבר מחדש' }
      const { data: financeRow, error: financeError } = await supabase
        .from('admin_finance_entries')
        .insert({
          entry_type: entryType,
          amount,
          description,
          entry_date: formStart,
          admin_user_id: null,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (financeError || !financeRow) {
        const msg = financeError?.message ?? ''
        return {
          financeEntryId: null,
          error:
            msg.includes('entry_type') || msg.includes('check')
              ? 'יש להריץ את עדכון מסד הנתונים (APPLY_BOOKING_PAID_FUTURE_INCOME.sql)'
              : msg || 'שגיאה ביצירת רשומת הכנסה',
        }
      }
      return { financeEntryId: financeRow.id as string, error: null }
    }

    if (existingFinanceId) {
      const { error: financeError } = await supabase
        .from('admin_finance_entries')
        .delete()
        .eq('id', existingFinanceId)
      if (financeError) return { financeEntryId: null, error: financeError.message }
    }
    return { financeEntryId: null, error: null }
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
    const { financeEntryId, error: financeSyncError } = await syncBookingFinance({
      existingFinanceId,
      amount,
      customer,
      pkg: formPackage,
      isPaid: formPaid,
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
      is_paid: formPaid,
      finance_entry_id: financeEntryId,
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
      const msg = insertError?.message ?? 'שגיאה בשמירה'
      setError(
        msg.includes('scanner_bookings_no_overlap') || msg.includes('exclusion')
          ? 'הסורק כבר תפוס בתאריכים האלה'
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
    if (financeEntryId && amount != null) {
      setSuccessMsg(
        formPaid
          ? `ההזמנה נשמרה והוספה הכנסה של ${formatPriceIls(amount)}`
          : `ההזמנה נשמרה והוספה הכנסה עתידית של ${formatPriceIls(amount)}`,
      )
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

    const maxSort = scanners.reduce((m, s) => Math.max(m, s.sort_order), 0)
    const { data, error: insertError } = await supabase
      .from('scanners')
      .insert({
        name,
        code,
        notes: newNotes.trim() || null,
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
    setDeleteBookingId(null)
    setDeleting(false)
  }

  if (loading) return <CenteredLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {scanners.map((s) => (
            <span
              key={s.id}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs',
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
                <span className="text-warning">תחזוקה</span>
              )}
            </span>
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

      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="rounded-lg border border-border p-2 text-muted hover:border-secondary/40 hover:text-foreground"
            aria-label="חודש קודם"
          >
            <ChevronRight size={16} />
          </button>
          <h3 className="text-sm font-semibold text-foreground">
            {format(month, 'MMMM yyyy', { locale: he })}
          </h3>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-lg border border-border p-2 text-muted hover:border-secondary/40 hover:text-foreground"
            aria-label="חודש הבא"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="py-1 text-center text-[11px] font-medium text-muted">
              {d}
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {calendarWeeks.map((week) => {
            const weekBars = layoutWeekBookings(bookings, week)
            const laneCount = Math.max(
              weekBars.reduce((max, b) => Math.max(max, b.lane + 1), 0),
              1,
            )
            const LANE_H = 26
            const LANE_GAP = 4
            const HEADER_H = 34
            const barsBlockH = laneCount * LANE_H + Math.max(0, laneCount - 1) * LANE_GAP
            const bodyMinHeight = HEADER_H + barsBlockH + 10

            return (
              <div
                key={week[0].toISOString()}
                className="relative rounded-xl border border-border"
                style={{ minHeight: bodyMinHeight }}
              >
                <div className="grid grid-cols-7" style={{ minHeight: bodyMinHeight }}>
                  {week.map((day) => {
                    const inMonth = isSameMonth(day, month)
                    const isToday = isSameDay(day, new Date())
                    const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
                    const dayBookings = bookings.filter((b) => bookingCoversDay(b, day))
                    const activeCount = activeScanners.filter((s) => s.status === 'active').length
                    const bookedActive = activeScanners.filter(
                      (s) => s.status === 'active' && dayBookings.some((b) => b.scanner_id === s.id),
                    ).length
                    const freeCount = Math.max(0, activeCount - bookedActive)

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => openDayDetail(day)}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          openBooking(day)
                        }}
                        className={cn(
                          'flex flex-col border-e border-border/70 p-1.5 text-right transition-colors last:border-e-0',
                          inMonth ? 'bg-surface' : 'bg-surface-elevated/40',
                          isToday && 'bg-secondary/5',
                          isSelected && 'ring-inset ring-1 ring-secondary/40',
                          'hover:bg-secondary/5',
                        )}
                        style={{ minHeight: bodyMinHeight }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-semibold tabular-nums',
                              inMonth ? 'text-foreground' : 'text-muted/50',
                              isToday && 'bg-secondary text-white',
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          {inMonth && activeCount > 0 && (
                            <span
                              className={cn(
                                'rounded px-1 text-[9px] font-medium tabular-nums',
                                freeCount === 0
                                  ? 'bg-danger/15 text-danger'
                                  : freeCount === activeCount
                                    ? 'bg-success/15 text-success'
                                    : 'bg-warning/15 text-warning',
                              )}
                              title={`${freeCount} פנויים מתוך ${activeCount}`}
                            >
                              {freeCount}/{activeCount}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Continuous family bars — one lane per overlapping booking */}
                {weekBars.length > 0 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 px-0.5"
                    style={{ top: HEADER_H, height: barsBlockH }}
                  >
                    {weekBars.map((bar) => {
                      const continuesBefore = bar.booking.start_date < dayISO(week[0])
                      const continuesAfter = bar.booking.end_date > dayISO(week[6])
                      const multiDay = bar.booking.start_date !== bar.booking.end_date
                      const colors = colorForFamily(bar.booking.customer_name)
                      const colPct = 100 / 7
                      return (
                        <button
                          key={bar.booking.id}
                          type="button"
                          onClick={() => openBookingDetail(bar.booking)}
                          title={`${bar.booking.customer_name} · ${formatRange(bar.booking.start_date, bar.booking.end_date)} · ${scannerLabel(bar.booking.scanner_id)}`}
                          className={cn(
                            'pointer-events-auto absolute z-10 flex items-center overflow-hidden px-1.5 text-start text-[11px] font-semibold leading-none shadow-sm transition-opacity hover:opacity-90',
                            multiDay && continuesBefore && continuesAfter && 'rounded-none',
                            multiDay && continuesBefore && !continuesAfter && 'rounded-e-md rounded-s-none',
                            multiDay && !continuesBefore && continuesAfter && 'rounded-s-md rounded-e-none',
                            (!multiDay || (!continuesBefore && !continuesAfter)) && 'rounded-md',
                          )}
                          style={{
                            top: bar.lane * (LANE_H + LANE_GAP),
                            height: LANE_H,
                            insetInlineStart: `calc(${bar.start * colPct}% + 2px)`,
                            width: `calc(${bar.span * colPct}% - 4px)`,
                            backgroundColor: colors.bg,
                            color: colors.text,
                          }}
                        >
                          <span className="truncate">{bar.booking.customer_name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-[11px] text-muted">
          בקוביה מוצגות כל המשפחות · משפחה לכמה ימים מופיעה כרצועה צבעונית מתמשכת · לחיצה פותחת את כל הפרטים · לחיצה כפולה להזמנה חדשה
        </p>
      </Card>

      {/* Resource timeline: scanners × days of month with continuous family bars */}
      <Card className="overflow-x-auto p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">לוח תפוסה</h3>
        {activeScanners.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">אין סורקים עדיין. הוסף סורק חדש.</p>
        ) : (
          <div className="min-w-[720px] space-y-2">
            <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `132px repeat(${daysInMonth.length}, minmax(18px, 1fr))` }}
            >
              <div />
              {daysInMonth.map((d) => (
                <div
                  key={d.toISOString()}
                  className={cn(
                    'text-center text-[9px] text-muted',
                    isSameDay(d, new Date()) && 'font-bold text-secondary',
                  )}
                >
                  {format(d, 'd')}
                </div>
              ))}
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
                  const span = bookingSpanInDays(booking, daysInMonth)
                  return span ? { booking, ...span } : null
                })
                .filter((x): x is { booking: ScannerBooking; start: number; span: number } => x != null)

              if (row.key === '__none__' && spans.length === 0) return null

              return (
                <div key={row.key} className="flex items-stretch gap-0.5">
                  <div className="flex w-[132px] shrink-0 items-center gap-1.5 truncate pe-2 text-xs text-foreground">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', row.color)} />
                    <span className="truncate font-medium">{row.label}</span>
                  </div>
                  <div
                    className="grid h-9 min-w-0 flex-1 gap-0.5"
                    style={{ gridTemplateColumns: `repeat(${daysInMonth.length}, minmax(0, 1fr))` }}
                  >
                    {daysInMonth.map((d, dayIdx) => {
                      const occupied = spans.some(
                        (s) => dayIdx >= s.start && dayIdx < s.start + s.span,
                      )
                      return (
                        <button
                          key={d.toISOString()}
                          type="button"
                          onClick={() => openDayDetail(d)}
                          className={cn(
                            'row-start-1 rounded-sm border border-border/30 bg-surface-elevated/50',
                            isSameDay(d, new Date()) && 'ring-1 ring-secondary/40',
                          )}
                          style={{ gridColumn: dayIdx + 1 }}
                          title={occupied ? 'לחיצה לפרטי היום' : 'פנוי — לחיצה לפרטי היום'}
                          aria-label={`${format(d, 'd/M')}${occupied ? '' : ' פנוי'}`}
                        />
                      )
                    })}
                    {spans.map(({ booking, start, span }) => {
                      const colors = colorForFamily(booking.customer_name)
                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => openBookingDetail(booking)}
                          title={`${booking.customer_name} · ${formatRange(booking.start_date, booking.end_date)}`}
                          className="z-10 row-start-1 mx-px flex items-center overflow-hidden rounded-md px-1 text-start text-[10px] font-semibold transition-opacity hover:opacity-90"
                          style={{
                            gridColumn: `${start + 1} / span ${span}`,
                            backgroundColor: colors.bg,
                            color: colors.text,
                          }}
                        >
                          <span className="truncate">{booking.customer_name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
            <p className="text-sm text-muted">אין הזמנות ביום זה — כל הסורקים הפעילים פנויים.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayBookings.map((b) => (
                <BookingDetailCard
                  key={b.id}
                  booking={b}
                  scannerLabel={scannerLabel(b.scanner_id)}
                  eventLabel={eventLabel(b.event_id)}
                  packageLabel={packageLabel(b.booking_package)}
                  onEdit={() => openEditBooking(b)}
                  onDelete={() => {
                    closeDetail()
                    setDeleteBookingId(b.id)
                  }}
                  onResetScans={
                    b.event_id
                      ? () => {
                          setResetEventTarget({
                            eventId: b.event_id!,
                            eventName: eventLabel(b.event_id),
                          })
                        }
                      : undefined
                  }
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
            scannerLabel={scannerLabel(selectedBooking.scanner_id)}
            eventLabel={eventLabel(selectedBooking.event_id)}
            packageLabel={packageLabel(selectedBooking.booking_package)}
            onEdit={() => openEditBooking(selectedBooking)}
            onDelete={() => {
              const id = selectedBooking.id
              closeDetail()
              setDeleteBookingId(id)
            }}
            onResetScans={
              selectedBooking.event_id
                ? () => {
                    setResetEventTarget({
                      eventId: selectedBooking.event_id!,
                      eventName: eventLabel(selectedBooking.event_id),
                    })
                  }
                : undefined
            }
          />
        )}
      </Modal>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          הזמנות בחודש ({monthBookings.length})
        </h3>
        {monthBookings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted">
            אין הזמנות בחודש זה
          </div>
        ) : (
          <div className="space-y-1.5">
            {monthBookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                label={scannerLabel(b.scanner_id)}
                eventLabel={eventLabel(b.event_id)}
                packageLabel={packageLabel(b.booking_package)}
                color={colorForScanner(scanners, b.scanner_id)}
                onEdit={() => openEditBooking(b)}
                onDelete={() => setDeleteBookingId(b.id)}
              />
            ))}
          </div>
        )}
      </div>

      {error && !bookingOpen && !scannerOpen && (
        <p className="text-sm text-danger">{error}</p>
      )}
      {successMsg && !bookingOpen && !scannerOpen && (
        <p className="text-sm text-success">{successMsg}</p>
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
              const base = PLAN_BASE_PRICES[pkg]
              const suffix =
                base == null
                  ? ' — מחיר לפי הסכם'
                  : pkg === 'full' || pkg === 'offline'
                    ? ` — מ-${formatPriceIls(base)} (+${formatPriceIls(EXTRA_DAY_PRICE)} ליום נוסף)`
                    : ` — ${formatPriceIls(base)}`
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
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2" dir="rtl">
            <div className="space-y-1">
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
                }}
                placeholder={suggestedPrice != null ? String(suggestedPrice) : 'הזיני מחיר'}
              />
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
                  <span>המחיר יתווסף אוטומטית כהכנסה</span>
                )}
                {suggestedPrice != null && !autoPrice && (
                  <button
                    type="button"
                    className="text-start text-secondary hover:underline"
                    onClick={() => setAutoPrice(true)}
                  >
                    חשב מחדש לפי חבילה ותאריכים
                  </button>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface-elevated/40 px-3 py-2.5 sm:mt-6">
              <Checkbox
                id="booking-paid"
                label="שולם"
                checked={formPaid}
                onChange={(e) => setFormPaid(e.target.checked)}
              />
              <p className="mt-1 text-[11px] text-muted">
                {formPaid
                  ? 'יירשם כהכנסה בלוח הכספים'
                  : 'יירשם כהכנסה עתידית עד שיסומן כשולם'}
              </p>
            </div>
          </div>
          <Select
            id="booking-event"
            label="משחק מקושר (אופציונלי)"
            value={formEventId}
            onChange={(e) => onFormEventChange(e.target.value)}
          >
            <option value="">ללא קישור למשחק</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name?.trim() || 'משחק ללא שם'}
              </option>
            ))}
          </Select>
          <Select
            id="booking-scanner"
            label="סורק (אופציונלי)"
            value={formScannerId}
            onChange={(e) => setFormScannerId(e.target.value)}
          >
            <option value="">ללא סורק</option>
            {activeScanners.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
                {s.status === 'maintenance' ? ' — תחזוקה' : ''}
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
          {error && <p className="text-sm text-danger">{error}</p>}
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
        title="הוספת סורק"
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
            label="הערות"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <ModalActions>
            <Button type="submit" loading={saving}>
              הוסף סורק
            </Button>
            <Button type="button" variant="outline" onClick={() => setScannerOpen(false)}>
              ביטול
            </Button>
          </ModalActions>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteBookingId}
        onClose={() => setDeleteBookingId(null)}
        onConfirm={confirmDeleteBooking}
        title="מחיקת הזמנה"
        description="למחוק את ההזמנה? אם נוצרה רשומת הכנסה מקושרת — גם היא תימחק. סורק משויך יהיה פנוי שוב."
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

function BookingRow({
  booking,
  label,
  eventLabel,
  packageLabel,
  color,
  onEdit,
  onDelete,
}: {
  booking: ScannerBooking
  label: string
  eventLabel: string
  packageLabel: string
  color: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="group/row flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-all hover:border-secondary/40">
      <span className={cn('h-8 w-1.5 shrink-0 rounded-full', color)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{booking.customer_name}</p>
        <p className="mt-0.5 text-[11px] text-muted">
          {packageLabel}
          {booking.amount != null ? ` · ${formatPriceIls(Number(booking.amount))}` : ''}
          {' · '}
          {booking.is_paid ? 'שולם' : 'לא שולם'}
          {' · '}
          {eventLabel} · {label} · {formatRange(booking.start_date, booking.end_date)}
          {booking.customer_phone ? ` · ${booking.customer_phone}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg p-1 text-muted opacity-0 transition-all hover:bg-surface-elevated hover:text-foreground group-hover/row:opacity-100"
        title="עריכה"
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded-lg p-1 text-muted opacity-0 transition-all hover:bg-surface-elevated hover:text-danger group-hover/row:opacity-100"
        title="מחיקה"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function BookingDetailCard({
  booking,
  scannerLabel,
  eventLabel,
  packageLabel,
  onEdit,
  onDelete,
  onResetScans,
}: {
  booking: ScannerBooking
  scannerLabel: string
  eventLabel: string
  packageLabel: string
  onEdit: () => void
  onDelete: () => void
  onResetScans?: () => void
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'משפחה / לקוח', value: booking.customer_name },
    { label: 'חבילה', value: packageLabel },
    {
      label: 'מחיר',
      value: booking.amount != null ? formatPriceIls(Number(booking.amount)) : '—',
    },
    { label: 'תשלום', value: booking.is_paid ? 'שולם' : 'לא שולם (הכנסה עתידית)' },
    { label: 'משחק', value: eventLabel },
    { label: 'סורק', value: scannerLabel },
    { label: 'תאריכים', value: formatRange(booking.start_date, booking.end_date) },
  ]
  if (booking.finance_entry_id) {
    rows.push({
      label: 'הכנסה',
      value: booking.is_paid ? 'נרשמה בלוח הכספים' : 'נרשמה כהכנסה עתידית',
    })
  }
  if (booking.customer_phone) rows.push({ label: 'טלפון', value: booking.customer_phone })
  if (booking.customer_email) rows.push({ label: 'אימייל', value: booking.customer_email })
  if (booking.notes) rows.push({ label: 'הערות', value: booking.notes })

  const familyColor = colorForFamily(booking.customer_name)

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
            <dd className="font-medium text-foreground break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil size={14} className="ml-1" />
          עריכה
        </Button>
        {onResetScans && (
          <Button type="button" variant="outline" size="sm" onClick={onResetScans}>
            <RotateCcw size={14} className="ml-1" />
            איפוס סריקות למשחק
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onDelete}>
          <Trash2 size={14} className="ml-1" />
          מחק הזמנה
        </Button>
      </div>
    </div>
  )
}
