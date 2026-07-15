import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  ScanLine,
  CalendarPlus,
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
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { KpiCard } from '@/components/admin/analytics/KpiCard'
import { cn } from '@/lib/utils'
import type { Scanner, ScannerBooking } from '@/types'

const SCANNER_COLORS = [
  'bg-secondary/80',
  'bg-primary/80',
  'bg-tertiary/80',
  'bg-success/70',
  'bg-warning/80',
  'bg-accent/80',
  'bg-danger/70',
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

function colorForScanner(scanners: Scanner[], scannerId: string): string {
  const idx = scanners.findIndex((s) => s.id === scannerId)
  return SCANNER_COLORS[idx >= 0 ? idx % SCANNER_COLORS.length : 0]
}

export function AdminScannersPanel() {
  const { user } = useAuth()
  const [scanners, setScanners] = useState<Scanner[]>([])
  const [bookings, setBookings] = useState<ScannerBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

  const [bookingOpen, setBookingOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // booking form
  const [formScannerId, setFormScannerId] = useState('')
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
      const [scannersRes, bookingsRes] = await Promise.all([
        supabase
          .from('scanners')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('scanner_bookings')
          .select('*')
          .order('start_date', { ascending: true }),
      ])

      if (scannersRes.error) setError(scannersRes.error.message)
      else setScanners((scannersRes.data as Scanner[]) ?? [])

      if (bookingsRes.error) setError(bookingsRes.error.message)
      else setBookings((bookingsRes.data as ScannerBooking[]) ?? [])

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

  const todayStats = useMemo(() => {
    const today = new Date()
    const active = activeScanners.filter((s) => s.status === 'active')
    const bookedIds = new Set(
      bookings
        .filter((b) => bookingCoversDay(b, today))
        .map((b) => b.scanner_id),
    )
    const bookedToday = active.filter((s) => bookedIds.has(s.id)).length
    return {
      total: active.length,
      booked: bookedToday,
      available: Math.max(0, active.length - bookedToday),
    }
  }, [activeScanners, bookings])

  const selectedDayBookings = useMemo(() => {
    if (!selectedDay) return []
    return bookings.filter((b) => bookingCoversDay(b, selectedDay))
  }, [bookings, selectedDay])

  function scannerLabel(id: string): string {
    const s = scanners.find((x) => x.id === id)
    return s ? `${s.name} (${s.code})` : 'סורק'
  }

  function openBooking(day?: Date) {
    const iso = day ? format(day, 'yyyy-MM-dd') : todayISO()
    setFormStart(iso)
    setFormEnd(iso)
    setFormCustomer('')
    setFormPhone('')
    setFormEmail('')
    setFormNotes('')
    setFormScannerId(activeScanners[0]?.id ?? '')
    setError(null)
    setBookingOpen(true)
  }

  function openAddScanner() {
    const nextNum = scanners.length + 1
    setNewName(`סורק ${nextNum}`)
    setNewCode(`SCAN-${String(nextNum).padStart(2, '0')}`)
    setNewNotes('')
    setError(null)
    setScannerOpen(true)
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault()
    if (!user || saving) return

    const customer = formCustomer.trim()
    if (!formScannerId) {
      setError('יש לבחור סורק')
      return
    }
    if (!customer) {
      setError('יש להזין שם לקוח')
      return
    }
    if (formEnd < formStart) {
      setError('תאריך סיום חייב להיות אחרי תאריך התחלה')
      return
    }

    const conflict = bookings.some(
      (b) =>
        b.scanner_id === formScannerId &&
        rangesOverlap(formStart, formEnd, b.start_date, b.end_date),
    )
    if (conflict) {
      setError('הסורק כבר תפוס בתאריכים האלה')
      return
    }

    setSaving(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('scanner_bookings')
      .insert({
        scanner_id: formScannerId,
        start_date: formStart,
        end_date: formEnd,
        customer_name: customer,
        customer_phone: formPhone.trim() || null,
        customer_email: formEmail.trim() || null,
        notes: formNotes.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError || !data) {
      const msg = insertError?.message ?? 'שגיאה בשמירה'
      setError(
        msg.includes('scanner_bookings_no_overlap') || msg.includes('exclusion')
          ? 'הסורק כבר תפוס בתאריכים האלה'
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
    setBookingOpen(false)
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
    setBookings((items) => items.filter((b) => b.id !== deleteBookingId))
    const { error: delError } = await supabase
      .from('scanner_bookings')
      .delete()
      .eq('id', deleteBookingId)
    if (delError) {
      setBookings(prev)
      setError(delError.message)
    }
    setDeleteBookingId(null)
    setDeleting(false)
  }

  if (loading) return <CenteredLoader />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="סורקים פעילים"
          value={todayStats.total}
          accent="primary"
          icon={<ScanLine size={18} />}
        />
        <KpiCard
          label="תפוסים היום"
          value={todayStats.booked}
          accent="tertiary"
        />
        <KpiCard
          label="פנויים היום"
          value={todayStats.available}
          accent="secondary"
          hint="מכשירי סריקה למסלול מלא"
        />
      </div>

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
          <Button size="sm" onClick={() => openBooking()} disabled={activeScanners.length === 0}>
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

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const inMonth = isSameMonth(day, month)
            const isToday = isSameDay(day, new Date())
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
            const dayBookings = bookings.filter((b) => bookingCoversDay(b, day))
            const uniqueScannerIds = [...new Set(dayBookings.map((b) => b.scanner_id))]

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  setSelectedDay(day)
                }}
                onDoubleClick={() => openBooking(day)}
                className={cn(
                  'min-h-[72px] rounded-xl border p-1.5 text-right transition-colors',
                  inMonth ? 'border-border bg-surface' : 'border-transparent bg-surface-elevated/40',
                  isToday && 'ring-1 ring-secondary/50',
                  isSelected && 'border-secondary/50 bg-secondary/5',
                  'hover:border-secondary/40',
                )}
              >
                <div
                  className={cn(
                    'mb-1 text-[11px] font-medium',
                    inMonth ? 'text-foreground' : 'text-muted/60',
                    isToday && 'text-secondary',
                  )}
                >
                  {format(day, 'd')}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {uniqueScannerIds.slice(0, 4).map((sid) => (
                    <span
                      key={sid}
                      title={scannerLabel(sid)}
                      className={cn('h-1.5 w-3 rounded-full', colorForScanner(scanners, sid))}
                    />
                  ))}
                  {uniqueScannerIds.length > 4 && (
                    <span className="text-[9px] text-muted">+{uniqueScannerIds.length - 4}</span>
                  )}
                </div>
                {dayBookings.length > 0 && (
                  <p className="mt-1 truncate text-[10px] text-muted">
                    {dayBookings[0].customer_name}
                    {dayBookings.length > 1 ? ` +${dayBookings.length - 1}` : ''}
                  </p>
                )}
              </button>
            )
          })}
        </div>

        <p className="mt-3 text-[11px] text-muted">
          לחיצה על יום מציגה פרטים · לחיצה כפולה פותחת הזמנה חדשה לתאריך
        </p>
      </Card>

      {/* Resource timeline: scanners × days of month */}
      <Card className="overflow-x-auto p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">לוח תפוסה לפי סורק</h3>
        {activeScanners.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">אין סורקים עדיין. הוסף סורק חדש.</p>
        ) : (
          <div className="min-w-[640px] space-y-2">
            {(() => {
              const daysInMonth = eachDayOfInterval({
                start: startOfMonth(month),
                end: endOfMonth(month),
              })
              return (
                <>
                  <div
                    className="grid gap-0.5"
                    style={{ gridTemplateColumns: `120px repeat(${daysInMonth.length}, minmax(14px, 1fr))` }}
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
                  {activeScanners.map((scanner) => (
                    <div
                      key={scanner.id}
                      className="grid gap-0.5 items-stretch"
                      style={{ gridTemplateColumns: `120px repeat(${daysInMonth.length}, minmax(14px, 1fr))` }}
                    >
                      <div className="flex items-center gap-1.5 truncate pe-2 text-xs text-foreground">
                        <span
                          className={cn('h-2 w-2 shrink-0 rounded-full', colorForScanner(scanners, scanner.id))}
                        />
                        <span className="truncate">{scanner.name}</span>
                      </div>
                      {daysInMonth.map((d) => {
                        const occupied = bookings.some(
                          (b) => b.scanner_id === scanner.id && bookingCoversDay(b, d),
                        )
                        return (
                          <div
                            key={d.toISOString()}
                            title={
                              occupied
                                ? bookings
                                    .filter((b) => b.scanner_id === scanner.id && bookingCoversDay(b, d))
                                    .map((b) => b.customer_name)
                                    .join(', ')
                                : 'פנוי'
                            }
                            className={cn(
                              'h-7 rounded-sm border border-border/40',
                              occupied
                                ? colorForScanner(scanners, scanner.id)
                                : 'bg-surface-elevated/50',
                            )}
                          />
                        )
                      })}
                    </div>
                  ))}
                </>
              )
            })()}
          </div>
        )}
      </Card>

      {selectedDay && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {format(selectedDay, 'EEEE, d בMMMM yyyy', { locale: he })}
            </h3>
            <Button size="sm" variant="outline" onClick={() => openBooking(selectedDay)}>
              <Plus size={14} className="ml-1" />
              הזמנה ליום זה
            </Button>
          </div>
          {selectedDayBookings.length === 0 ? (
            <p className="text-sm text-muted">אין הזמנות ביום זה — כל הסורקים הפעילים פנויים.</p>
          ) : (
            <div className="space-y-1.5">
              {selectedDayBookings.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  label={scannerLabel(b.scanner_id)}
                  color={colorForScanner(scanners, b.scanner_id)}
                  onDelete={() => setDeleteBookingId(b.id)}
                />
              ))}
            </div>
          )}
        </Card>
      )}

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
                color={colorForScanner(scanners, b.scanner_id)}
                onDelete={() => setDeleteBookingId(b.id)}
              />
            ))}
          </div>
        )}
      </div>

      {error && !bookingOpen && !scannerOpen && (
        <p className="text-sm text-danger">{error}</p>
      )}

      <Modal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        title="הזמנת סורק"
        dialogClassName="max-w-md"
      >
        <form onSubmit={submitBooking} className="space-y-3">
          <Select
            id="booking-scanner"
            label="סורק"
            value={formScannerId}
            onChange={(e) => setFormScannerId(e.target.value)}
            required
          >
            {activeScanners.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
                {s.status === 'maintenance' ? ' — תחזוקה' : ''}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="booking-start"
              label="מתאריך"
              type="date"
              value={formStart}
              onChange={(e) => setFormStart(e.target.value)}
              required
            />
            <Input
              id="booking-end"
              label="עד תאריך"
              type="date"
              value={formEnd}
              onChange={(e) => setFormEnd(e.target.value)}
              required
            />
          </div>
          <Input
            id="booking-customer"
            label="שם לקוח / אירוע"
            value={formCustomer}
            onChange={(e) => setFormCustomer(e.target.value)}
            placeholder="למשל: אירוע משפחת כהן"
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
              שמור הזמנה
            </Button>
            <Button type="button" variant="outline" onClick={() => setBookingOpen(false)}>
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
        description="למחוק את ההזמנה? הסורק יהיה פנוי שוב בתאריכים האלה."
        confirmLabel="מחק"
        loading={deleting}
      />
    </div>
  )
}

function BookingRow({
  booking,
  label,
  color,
  onDelete,
}: {
  booking: ScannerBooking
  label: string
  color: string
  onDelete: () => void
}) {
  return (
    <div className="group/row flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-all hover:border-secondary/40">
      <span className={cn('h-8 w-1.5 shrink-0 rounded-full', color)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{booking.customer_name}</p>
        <p className="mt-0.5 text-[11px] text-muted">
          {label} · {formatRange(booking.start_date, booking.end_date)}
          {booking.customer_phone ? ` · ${booking.customer_phone}` : ''}
        </p>
      </div>
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
