import { useState, useEffect, useMemo } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Clock3,
  Scale,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { KpiCard } from '@/components/admin/analytics/KpiCard'
import {
  adminLabel,
  computeAdminSplit,
  formatMoney,
  type FinanceAdmin,
} from '@/lib/financeSplit'
import { cn } from '@/lib/utils'
import type { AdminFinanceEntry, FinanceEntryType } from '@/types'

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
  const [admins, setAdmins] = useState<FinanceAdmin[]>([])
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
          .select('id, email, display_name, in_finance_split')
          .eq('role', 'super_admin')
          .order('display_name', { ascending: true }),
      ])

      if (entriesRes.error) {
        setError(entriesRes.error.message)
      } else {
        setEntries((entriesRes.data as AdminFinanceEntry[]) ?? [])
      }

      // Before the migration runs, in_finance_split doesn't exist yet - fall back
      // to the plain columns so the ledger still loads (everyone splits evenly).
      let adminList = (adminsRes.data as FinanceAdmin[]) ?? []
      if (adminsRes.error) {
        const { data: legacy } = await supabase
          .from('user_profiles')
          .select('id, email, display_name')
          .eq('role', 'super_admin')
          .order('display_name', { ascending: true })
        adminList = ((legacy as Omit<FinanceAdmin, 'in_finance_split'>[]) ?? []).map((a) => ({
          ...a,
          in_finance_split: true,
        }))
        setError('יש להריץ את עדכון מסד הנתונים (APPLY_FINANCE_INCOME_ATTRIBUTION.sql)')
      }
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

  const split = useMemo(() => computeAdminSplit(entries, admins), [entries, admins])

  const filteredEntries = useMemo(() => {
    if (filterAdminId === 'all') return entries
    if (filterAdminId === 'none') return entries.filter((e) => !e.admin_user_id)
    return entries.filter((e) => e.admin_user_id === filterAdminId)
  }, [entries, filterAdminId])

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

  /** Re-points an existing entry at another admin, straight from the list. */
  async function reassignEntry(entryId: string, nextAdminId: string) {
    const target = entries.find((e) => e.id === entryId)
    if (!target) return
    const previous = target.admin_user_id
    const value = nextAdminId || null
    if (value === previous) return

    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, admin_user_id: value } : e)),
    )
    const { error: updateError } = await supabase
      .from('admin_finance_entries')
      .update({ admin_user_id: value })
      .eq('id', entryId)
    if (updateError) {
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, admin_user_id: previous } : e)),
      )
      setError(
        updateError.message.includes('admin_finance_expense_requires_admin')
          ? 'הוצאה חייבת להיות משויכת לאדמין'
          : updateError.message,
      )
    }
  }

  /** Adds or removes an admin from the even split of the pot. */
  async function toggleSplitMember(adminId: string, included: boolean) {
    const previous = admins
    setAdmins((prev) =>
      prev.map((a) => (a.id === adminId ? { ...a, in_finance_split: included } : a)),
    )
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ in_finance_split: included })
      .eq('id', adminId)
    if (updateError) {
      setAdmins(previous)
      setError(
        updateError.message.includes('in_finance_split')
          ? 'יש להריץ את עדכון מסד הנתונים (APPLY_FINANCE_INCOME_ATTRIBUTION.sql)'
          : updateError.message,
      )
    }
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
        <div className="mb-1 flex items-center gap-2">
          <Users size={16} className="text-secondary-text" />
          <h3 className="text-sm font-semibold text-foreground">לאן נכנס הכסף</h3>
        </div>
        <p className="mb-4 text-[11px] text-muted">
          כמה נכנס דרך כל אדמין, כמה הוא הוציא, וכמה מגיע לו מתוך הקופה
          {split.participantCount > 0 && (
            <> · הקופה מתחלקת שווה בשווה בין {split.participantCount} אדמינים</>
          )}
        </p>

        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted">
                <th className="px-2 py-2 text-start font-medium">אדמין</th>
                <th className="px-2 py-2 text-center font-medium">נכנס אליו</th>
                <th className="px-2 py-2 text-center font-medium">עתידי</th>
                <th className="px-2 py-2 text-center font-medium">הוציא</th>
                <th className="px-2 py-2 text-center font-medium">מחזיק</th>
                <th className="px-2 py-2 text-center font-medium">מגיע לו</th>
                <th className="px-2 py-2 text-center font-medium">הפרש</th>
              </tr>
            </thead>
            <tbody>
              {split.rows.map((row) => {
                const isUnattributed = row.adminId === null
                return (
                  <tr
                    key={row.adminId ?? 'none'}
                    className={cn(
                      'border-b border-border/60 last:border-0',
                      isUnattributed && 'bg-warning/5',
                    )}
                  >
                    <td className="px-2 py-2.5">
                      <p className="font-medium text-foreground">{row.label}</p>
                      {isUnattributed ? (
                        <p className="text-[11px] text-muted">לא ידוע למי נכנס</p>
                      ) : (
                        <label
                          htmlFor={`split-member-${row.adminId}`}
                          className="mt-1 flex items-center gap-1.5 text-[11px] text-muted"
                        >
                          <input
                            id={`split-member-${row.adminId}`}
                            type="checkbox"
                            checked={row.inSplit}
                            onChange={(e) =>
                              toggleSplitMember(row.adminId as string, e.target.checked)
                            }
                            className="h-3.5 w-3.5 rounded border-border bg-surface"
                          />
                          משתתף בחלוקה
                        </label>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className="font-semibold tabular-nums text-success-text">
                        {formatMoney(row.income)}
                      </span>
                      {row.income > 0 && (
                        <span className="block text-[11px] text-muted">{row.incomeShare}%</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums text-secondary-text">
                      {row.futureIncome > 0 ? formatMoney(row.futureIncome) : '-'}
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums text-danger-text">
                      {row.expense > 0 ? formatMoney(row.expense) : '-'}
                    </td>
                    <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-foreground">
                      {formatMoney(row.net)}
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums text-muted">
                      {isUnattributed ? '-' : formatMoney(row.entitled)}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {isUnattributed ? (
                        <span className="text-muted">-</span>
                      ) : (
                        <span
                          className={cn(
                            'rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums',
                            row.balance > 0.01 && 'bg-danger/10 text-danger-text',
                            row.balance < -0.01 && 'bg-success/10 text-success-text',
                            Math.abs(row.balance) <= 0.01 && 'text-muted',
                          )}
                          title={
                            row.balance > 0.01
                              ? 'מחזיק יותר מהחלק שלו - צריך להעביר'
                              : row.balance < -0.01
                                ? 'מחזיק פחות מהחלק שלו - מגיע לו'
                                : 'מאוזן'
                          }
                        >
                          {row.balance > 0.01 ? '+' : ''}
                          {formatMoney(row.balance)}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
            <span>
              קופה לחלוקה:{' '}
              <span className="font-semibold text-foreground">{formatMoney(split.pool)}</span>
            </span>
            <span>
              חלק שווה לכל אחד:{' '}
              <span className="font-semibold text-foreground">{formatMoney(split.fairShare)}</span>
            </span>
          </div>

          {split.unattributedIncome > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning-text" />
              <p>
                {formatMoney(split.unattributedIncome)} הכנסות עדיין ללא שיוך ולא נכנסות לחלוקה.
                שייכי אותן למטה ברשימת הרשומות כדי שההתחשבנות תהיה מדויקת.
              </p>
            </div>
          )}

          {split.transfers.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">התחשבנות - מי מעביר למי</p>
              {split.transfers.map((t, i) => (
                <div
                  key={`${t.fromAdminId}-${t.toAdminId}-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                >
                  <ArrowLeftRight size={15} className="shrink-0 text-secondary-text" />
                  <span className="min-w-0 flex-1 text-foreground">
                    <span className="font-medium">{t.fromLabel}</span> מעביר ל
                    <span className="font-medium">{t.toLabel}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">
                    {formatMoney(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
              <CheckCircle2 size={15} className="shrink-0 text-success-text" />
              הכל מאוזן - אין העברות פתוחות בין האדמינים
            </div>
          )}
        </div>
      </Card>

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

          <div className="space-y-1">
            <Select
              id="finance-admin"
              label={entryType === 'expense' ? 'מי שילם' : 'למי נכנס הכסף'}
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
            <p className="text-[11px] text-muted">
              {entryType === 'expense'
                ? 'ההוצאה תקוזז מהחלק של האדמין הזה בחלוקה'
                : 'קובע את החלוקה - בלי שיוך הסכום נשאר מחוץ להתחשבנות'}
            </p>
          </div>

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
              <option value="none">ללא שיוך</option>
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
                  className={cn(
                    'group/row flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-surface px-3 py-2.5 transition-all hover:border-secondary/40',
                    !entry.admin_user_id && !isFuture
                      ? 'border-warning/40'
                      : 'border-border',
                  )}
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

                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
                    <span className="sr-only">
                      שיוך לאדמין: {entry.description}
                    </span>
                    <span aria-hidden>{isIncome || isFuture ? 'נכנס ל' : 'שילם'}</span>
                    <select
                      value={entry.admin_user_id ?? ''}
                      onChange={(e) => reassignEntry(entry.id, e.target.value)}
                      className={cn(
                        'max-w-[9rem] truncate rounded-lg border bg-surface px-2 py-1 text-[11px] text-foreground',
                        entry.admin_user_id
                          ? 'border-border'
                          : 'border-warning/50 text-warning-text',
                      )}
                    >
                      {entry.entry_type !== 'expense' && (
                        <option value="">{adminLabel(admins, null)}</option>
                      )}
                      {admins.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.display_name || a.email}
                        </option>
                      ))}
                    </select>
                  </label>

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
