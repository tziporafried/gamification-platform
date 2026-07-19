import { useState, useEffect, useMemo } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Clock3, Scale, Trash2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { KpiCard, formatNumber } from '@/components/admin/analytics/KpiCard'
import { cn } from '@/lib/utils'
import type { AdminFinanceEntry, FinanceEntryType } from '@/types'

interface AdminUser {
  id: string
  email: string
  display_name: string | null
}

function formatMoney(amount: number): string {
  return `₪${formatNumber(Math.round(amount * 100) / 100)}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatEntryDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function AdminFinancePanel() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<AdminFinanceEntry[]>([])
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [entryType, setEntryType] = useState<FinanceEntryType>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [entryDate, setEntryDate] = useState(todayISO)
  const [adminUserId, setAdminUserId] = useState('')
  const [filterAdminId, setFilterAdminId] = useState<string>('all')

  useEffect(() => {
    async function fetchData() {
      const [entriesRes, adminsRes] = await Promise.all([
        supabase
          .from('admin_finance_entries')
          .select('*')
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('user_profiles')
          .select('id, email, display_name')
          .eq('role', 'super_admin')
          .order('display_name', { ascending: true }),
      ])

      if (entriesRes.error) {
        setError(entriesRes.error.message)
      } else {
        setEntries((entriesRes.data as AdminFinanceEntry[]) ?? [])
      }

      const adminList = (adminsRes.data as AdminUser[]) ?? []
      setAdmins(adminList)
      if (user?.id && adminList.some((a) => a.id === user.id)) {
        setAdminUserId(user.id)
      } else if (adminList[0]) {
        setAdminUserId(adminList[0].id)
      }
      setLoading(false)
    }
    fetchData()
  }, [user?.id])

  const totals = useMemo(() => {
    let income = 0
    let futureIncome = 0
    let expense = 0
    for (const e of entries) {
      const n = Number(e.amount)
      if (e.entry_type === 'income') income += n
      else if (e.entry_type === 'future_income') futureIncome += n
      else expense += n
    }
    return {
      income,
      futureIncome,
      expense,
      balance: income - expense,
    }
  }, [entries])

  const filteredEntries = useMemo(() => {
    if (filterAdminId === 'all') return entries
    return entries.filter((e) => e.admin_user_id === filterAdminId)
  }, [entries, filterAdminId])

  function adminLabel(id: string | null): string {
    if (!id) return '—'
    const a = admins.find((x) => x.id === id)
    return a?.display_name || a?.email || 'אדמין'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || saving) return

    const parsed = Number(amount.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('יש להזין סכום חיובי')
      return
    }
    const trimmedDesc = description.trim()
    if (!trimmedDesc) {
      setError('יש להזין תיאור')
      return
    }
    if (entryType === 'expense' && !adminUserId) {
      setError('יש לשייך הוצאה לאדמין')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      entry_type: entryType,
      amount: parsed,
      description: trimmedDesc,
      entry_date: entryDate || todayISO(),
      admin_user_id: entryType === 'expense' ? adminUserId : adminUserId || null,
      created_by: user.id,
    }

    const { data, error: insertError } = await supabase
      .from('admin_finance_entries')
      .insert(payload)
      .select()
      .single()

    if (insertError || !data) {
      setError(insertError?.message ?? 'שגיאה בשמירה')
      setSaving(false)
      return
    }

    setEntries((prev) => [data as AdminFinanceEntry, ...prev])
    setAmount('')
    setDescription('')
    setEntryDate(todayISO())
    setSaving(false)
  }

  async function confirmDelete() {
    if (!deleteId || deleting) return
    setDeleting(true)
    const prev = entries
    setEntries((items) => items.filter((e) => e.id !== deleteId))
    const { error: delError } = await supabase
      .from('admin_finance_entries')
      .delete()
      .eq('id', deleteId)
    if (delError) {
      setEntries(prev)
      setError(delError.message)
    }
    setDeleteId(null)
    setDeleting(false)
  }

  if (loading) return <CenteredLoader />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="סה״כ הכנסות"
          value={formatMoney(totals.income)}
          accent="secondary"
          icon={<ArrowUpCircle size={18} />}
        />
        <KpiCard
          label="הכנסות עתידיות"
          value={formatMoney(totals.futureIncome)}
          accent="primary"
          hint="עדיין לא שולמו"
          icon={<Clock3 size={18} />}
        />
        <KpiCard
          label="סה״כ הוצאות"
          value={formatMoney(totals.expense)}
          accent="tertiary"
          icon={<ArrowDownCircle size={18} />}
        />
        <KpiCard
          label="מאזן"
          value={formatMoney(totals.balance)}
          accent={totals.balance >= 0 ? 'primary' : 'muted'}
          hint="הכנסות שהתקבלו פחות הוצאות"
          icon={<Scale size={18} />}
        />
      </div>

      <Card className="p-4">
        <h3 className="mb-4 text-sm font-semibold text-foreground">רשומה חדשה</h3>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEntryType('expense')
              if (!adminUserId && user?.id) setAdminUserId(user.id)
              else if (!adminUserId && admins[0]) setAdminUserId(admins[0].id)
            }}
            className={cn(
              'min-w-[6.5rem] flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
              entryType === 'expense'
                ? 'border-danger/40 bg-danger/10 text-danger-text'
                : 'border-border bg-surface text-muted hover:border-secondary/30',
            )}
          >
            הוצאה
          </button>
          <button
            type="button"
            onClick={() => setEntryType('income')}
            className={cn(
              'min-w-[6.5rem] flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
              entryType === 'income'
                ? 'border-success/40 bg-success/10 text-success-text'
                : 'border-border bg-surface text-muted hover:border-secondary/30',
            )}
          >
            הכנסה
          </button>
          <button
            type="button"
            onClick={() => setEntryType('future_income')}
            className={cn(
              'min-w-[6.5rem] flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
              entryType === 'future_income'
                ? 'border-secondary/40 bg-secondary/10 text-secondary-text'
                : 'border-border bg-surface text-muted hover:border-secondary/30',
            )}
          >
            הכנסה עתידית
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              id="finance-amount"
              label="סכום (₪)"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
            <Input
              id="finance-date"
              label="תאריך"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
          </div>

          <Input
            id="finance-description"
            label="תיאור"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              entryType === 'expense'
                ? 'למשל: שרתים / עיצוב / פרסום'
                : entryType === 'future_income'
                  ? 'למשל: הזמנה ממתינה לתשלום'
                  : 'למשל: תשלום מלקוח'
            }
            required
          />

          <Select
            id="finance-admin"
            label={entryType === 'expense' ? 'משויך לאדמין' : 'משויך לאדמין (אופציונלי)'}
            value={adminUserId}
            onChange={(e) => setAdminUserId(e.target.value)}
            required={entryType === 'expense'}
          >
            {entryType !== 'expense' && <option value="">ללא שיוך</option>}
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name || a.email}
              </option>
            ))}
          </Select>

          {error && (
            <p className="text-sm text-danger-text">{error}</p>
          )}

          <Button type="submit" loading={saving} className="w-full sm:w-auto">
            <Plus size={16} className="ml-1" />
            {entryType === 'expense'
              ? 'הוסף הוצאה'
              : entryType === 'future_income'
                ? 'הוסף הכנסה עתידית'
                : 'דווח הכנסה'}
          </Button>
        </form>
      </Card>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            רשומות ({filteredEntries.length})
          </h3>
          {admins.length > 0 && (
            <Select
              id="finance-filter-admin"
              value={filterAdminId}
              onChange={(e) => setFilterAdminId(e.target.value)}
              className="w-auto min-w-[160px]"
            >
              <option value="all">כל האדמינים</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.email}
                </option>
              ))}
            </Select>
          )}
        </div>

        {filteredEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted">
            אין רשומות עדיין. הוסף הוצאה או דווח על הכנסה למעלה.
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredEntries.map((entry) => {
              const isIncome = entry.entry_type === 'income'
              const isFuture = entry.entry_type === 'future_income'
              const typeLabel = isIncome
                ? 'הכנסה'
                : isFuture
                  ? 'הכנסה עתידית'
                  : 'הוצאה'
              return (
                <div
                  key={entry.id}
                  className="group/row flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-all hover:border-secondary/40"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      isIncome && 'bg-success/10 text-success-text',
                      isFuture && 'bg-secondary/10 text-secondary-text',
                      !isIncome && !isFuture && 'bg-danger/10 text-danger-text',
                    )}
                  >
                    {isIncome ? (
                      <ArrowUpCircle size={16} />
                    ) : isFuture ? (
                      <Clock3 size={16} />
                    ) : (
                      <ArrowDownCircle size={16} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{entry.description}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {formatEntryDate(entry.entry_date)}
                      {entry.admin_user_id && (
                        <> · {adminLabel(entry.admin_user_id)}</>
                      )}
                      <span className="mx-1">·</span>
                      {typeLabel}
                    </p>
                  </div>

                  <span
                    className={cn(
                      'shrink-0 text-sm font-semibold tabular-nums',
                      isIncome && 'text-success-text',
                      isFuture && 'text-secondary-text',
                      !isIncome && !isFuture && 'text-danger-text',
                    )}
                  >
                    {isIncome || isFuture ? '+' : '−'}
                    {formatMoney(Number(entry.amount))}
                  </span>

                  <button
                    type="button"
                    onClick={() => setDeleteId(entry.id)}
                    className="shrink-0 rounded-lg p-1 text-muted opacity-0 transition-all hover:bg-surface-elevated hover:text-danger-text group-hover/row:opacity-100"
                    title="מחיקה"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="מחיקת רשומה"
        description="למחוק את הרשומה? הפעולה אינה ניתנת לביטול."
        confirmLabel="מחק"
        loading={deleting}
      />
    </div>
  )
}
