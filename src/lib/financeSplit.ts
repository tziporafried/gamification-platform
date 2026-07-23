import type { AdminFinanceEntry } from '@/types'

export interface FinanceAdmin {
  id: string
  email: string
  display_name: string | null
  /** Takes an equal share of the pot. Off = collects money but is owed nothing. */
  in_finance_split: boolean
}

/** One admin's slice of the shared books. */
export interface AdminFinanceBreakdown {
  adminId: string | null
  /** Display name, email, or "ללא שיוך" for the unattributed bucket. */
  label: string
  /** Income already received into this admin's hands. */
  income: number
  /** Money promised but not yet paid. */
  futureIncome: number
  /** Expenses this admin paid out of pocket. */
  expense: number
  /** income - expense: what this admin is currently holding. */
  net: number
  /** Share of all received income that came in through this admin (0-100). */
  incomeShare: number
  /** Takes an equal share of the pot. False for the unattributed bucket. */
  inSplit: boolean
  /** What this admin should end up holding: fair share, or 0 if not in the split. */
  entitled: number
  /** net - entitled. Positive = holding too much, negative = owed money. */
  balance: number
}

/** "X transfers ₪amount to Y" - one step toward an even split. */
export interface SettlementTransfer {
  fromAdminId: string
  fromLabel: string
  toAdminId: string
  toLabel: string
  amount: number
}

export interface AdminSplit {
  /** Per-admin rows, highest income first; unattributed bucket last. */
  rows: AdminFinanceBreakdown[]
  /** Income that no admin is attributed to - not settleable until assigned. */
  unattributedIncome: number
  unattributedFutureIncome: number
  /** Attributed income minus attributed expenses - the pot being divided. */
  pool: number
  /** pool / number of admins in the split. */
  fairShare: number
  /** Admins the pot is divided between (in_finance_split). */
  participantCount: number
  /** Payments that even everyone out. Empty when already balanced. */
  transfers: SettlementTransfer[]
}

export const UNATTRIBUTED_LABEL = 'ללא שיוך'

export function formatMoney(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return `₪${new Intl.NumberFormat('he-IL').format(rounded)}`
}

export function adminLabel(
  admins: Pick<FinanceAdmin, 'id' | 'email' | 'display_name'>[],
  id: string | null,
): string {
  if (!id) return UNATTRIBUTED_LABEL
  const match = admins.find((a) => a.id === id)
  return match?.display_name || match?.email || 'אדמין'
}

/** Rounds to agorot so float noise never shows up as a ₪0.0000001 transfer. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Splits the shared ledger by admin and works out who owes whom.
 *
 * The pot is attributed income minus attributed expenses, divided evenly
 * between the admins flagged in_finance_split. An admin holding more than
 * their share transfers the excess to one holding less; the greedy matching
 * below produces at most (participants - 1) transfers. An admin outside the
 * split is entitled to nothing, so whatever they collected flows out to the
 * partners in full.
 *
 * Unattributed income is deliberately kept out of the pot - it can't be settled
 * before someone says whose hands it landed in - and is surfaced separately so
 * the panel can nudge for it.
 */
export function computeAdminSplit(
  entries: AdminFinanceEntry[],
  admins: FinanceAdmin[],
): AdminSplit {
  const byAdmin = new Map<string | null, AdminFinanceBreakdown>()

  function bucket(id: string | null): AdminFinanceBreakdown {
    const existing = byAdmin.get(id)
    if (existing) return existing
    const row: AdminFinanceBreakdown = {
      adminId: id,
      label: adminLabel(admins, id),
      income: 0,
      futureIncome: 0,
      expense: 0,
      net: 0,
      incomeShare: 0,
      inSplit: id != null && (admins.find((a) => a.id === id)?.in_finance_split ?? false),
      entitled: 0,
      balance: 0,
    }
    byAdmin.set(id, row)
    return row
  }

  // Every known admin gets a row, even with no activity, so the split reads as
  // a full picture rather than "whoever happened to log something".
  for (const a of admins) bucket(a.id)

  for (const entry of entries) {
    const row = bucket(entry.admin_user_id)
    const amount = Number(entry.amount) || 0
    if (entry.entry_type === 'income') row.income += amount
    else if (entry.entry_type === 'future_income') row.futureIncome += amount
    else row.expense += amount
  }

  const all = [...byAdmin.values()]
  for (const row of all) row.net = round2(row.income - row.expense)

  const totalIncome = all.reduce((sum, r) => sum + r.income, 0)
  for (const row of all) {
    row.income = round2(row.income)
    row.futureIncome = round2(row.futureIncome)
    row.expense = round2(row.expense)
    row.incomeShare = totalIncome > 0 ? Math.round((row.income / totalIncome) * 100) : 0
  }

  const unattributed = byAdmin.get(null)
  const attributed = all.filter((r) => r.adminId !== null)

  // Everything attributed goes into the pot - including money collected by an
  // admin outside the split, which they then hand over in full.
  const pool = round2(attributed.reduce((sum, r) => sum + r.net, 0))
  const participants = attributed.filter((r) => r.inSplit)
  const fairShare = participants.length > 0 ? round2(pool / participants.length) : 0

  for (const row of attributed) {
    row.entitled = row.inSplit ? fairShare : 0
    row.balance = round2(row.net - row.entitled)
  }

  const rows = [
    ...attributed.sort((a, b) => b.income - a.income || b.net - a.net),
    ...(unattributed && (unattributed.income || unattributed.futureIncome || unattributed.expense)
      ? [unattributed]
      : []),
  ]

  return {
    rows,
    unattributedIncome: round2(unattributed?.income ?? 0),
    unattributedFutureIncome: round2(unattributed?.futureIncome ?? 0),
    pool,
    fairShare,
    participantCount: participants.length,
    transfers: buildTransfers(attributed),
  }
}

/**
 * Greedy settle-up: whoever is holding the most excess pays whoever is short
 * the most, until everyone sits on their fair share.
 */
function buildTransfers(rows: AdminFinanceBreakdown[]): SettlementTransfer[] {
  const debtors = rows
    .map((r) => ({ row: r, delta: r.balance }))
    .filter((d) => d.delta > 0.01)
    .sort((a, b) => b.delta - a.delta)
  const creditors = rows
    .map((r) => ({ row: r, delta: -r.balance }))
    .filter((c) => c.delta > 0.01)
    .sort((a, b) => b.delta - a.delta)

  const transfers: SettlementTransfer[] = []
  let ci = 0
  for (const debtor of debtors) {
    let remaining = debtor.delta
    while (remaining > 0.01 && ci < creditors.length) {
      const creditor = creditors[ci]
      const amount = round2(Math.min(remaining, creditor.delta))
      if (amount > 0.01) {
        transfers.push({
          fromAdminId: debtor.row.adminId as string,
          fromLabel: debtor.row.label,
          toAdminId: creditor.row.adminId as string,
          toLabel: creditor.row.label,
          amount,
        })
      }
      remaining = round2(remaining - amount)
      creditor.delta = round2(creditor.delta - amount)
      if (creditor.delta <= 0.01) ci += 1
    }
  }
  return transfers
}
