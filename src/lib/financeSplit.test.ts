import assert from 'node:assert/strict'
import test from 'node:test'
import { computeAdminSplit, type FinanceAdmin } from './financeSplit.ts'
import type { AdminFinanceEntry, FinanceEntryType } from '@/types'

const ZIPI = 'admin-zipi'
const CHAYA = 'admin-chaya'
const COMPANY = 'admin-company'

const admins: FinanceAdmin[] = [
  { id: ZIPI, email: 'zipi@example.com', display_name: 'ציפי', in_finance_split: true },
  { id: CHAYA, email: 'chaya@example.com', display_name: 'חיה', in_finance_split: true },
]

let seq = 0
function entry(
  entry_type: FinanceEntryType,
  amount: number,
  admin_user_id: string | null,
): AdminFinanceEntry {
  seq += 1
  return {
    id: `e${seq}`,
    entry_type,
    amount,
    description: `רשומה ${seq}`,
    entry_date: '2026-07-01',
    admin_user_id,
    created_by: ZIPI,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  }
}

test('splits the pot evenly and points the transfer at the admin who is short', () => {
  const split = computeAdminSplit(
    [entry('income', 1000, ZIPI), entry('income', 200, CHAYA)],
    admins,
  )

  assert.equal(split.pool, 1200)
  assert.equal(split.fairShare, 600)
  assert.equal(split.participantCount, 2)
  assert.deepEqual(
    split.transfers.map((t) => [t.fromAdminId, t.toAdminId, t.amount]),
    [[ZIPI, CHAYA, 400]],
  )
})

test('expenses paid out of pocket reduce what the payer owes', () => {
  // Zipi collected 1000 but spent 400 of it; Chaya collected nothing.
  const split = computeAdminSplit(
    [entry('income', 1000, ZIPI), entry('expense', 400, ZIPI)],
    admins,
  )

  assert.equal(split.pool, 600)
  assert.equal(split.fairShare, 300)
  assert.deepEqual(
    split.transfers.map((t) => [t.fromAdminId, t.toAdminId, t.amount]),
    [[ZIPI, CHAYA, 300]],
  )
})

test('future income stays out of the pot but is reported per admin', () => {
  const split = computeAdminSplit(
    [entry('income', 500, ZIPI), entry('future_income', 900, CHAYA)],
    admins,
  )

  assert.equal(split.pool, 500)
  const chaya = split.rows.find((r) => r.adminId === CHAYA)
  assert.equal(chaya?.futureIncome, 900)
  assert.equal(chaya?.income, 0)
})

test('unattributed income is held aside instead of silently split', () => {
  const split = computeAdminSplit(
    [entry('income', 1000, ZIPI), entry('income', 300, null), entry('future_income', 50, null)],
    admins,
  )

  assert.equal(split.unattributedIncome, 300)
  assert.equal(split.unattributedFutureIncome, 50)
  assert.equal(split.pool, 1000, 'the 300 is not settleable yet')
  assert.deepEqual(
    split.transfers.map((t) => [t.fromAdminId, t.toAdminId, t.amount]),
    [[ZIPI, CHAYA, 500]],
  )
  assert.equal(
    split.rows[split.rows.length - 1]?.adminId,
    null,
    'unattributed bucket sorts last',
  )
})

test('an admin who collected nothing is still owed their half', () => {
  const split = computeAdminSplit([entry('income', 800, ZIPI)], admins)

  assert.equal(split.participantCount, 2)
  assert.equal(split.fairShare, 400)
  assert.deepEqual(
    split.transfers.map((t) => [t.fromAdminId, t.toAdminId, t.amount]),
    [[ZIPI, CHAYA, 400]],
  )
  assert.equal(split.rows.length, 2, 'both admins appear in the table')
})

test('an admin outside the split hands over everything they collected', () => {
  const withCompany: FinanceAdmin[] = [
    ...admins,
    { id: COMPANY, email: 'co@example.com', display_name: 'החברה', in_finance_split: false },
  ]
  const split = computeAdminSplit([entry('income', 900, COMPANY)], withCompany)

  assert.equal(split.participantCount, 2, 'the company account takes no share')
  assert.equal(split.pool, 900)
  assert.equal(split.fairShare, 450)
  assert.deepEqual(
    split.transfers
      .map((t) => [t.fromAdminId, t.toAdminId, t.amount])
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]))),
    [
      [COMPANY, CHAYA, 450],
      [COMPANY, ZIPI, 450],
    ],
  )
})

test('transfers always cancel out to zero', () => {
  const split = computeAdminSplit(
    [
      entry('income', 1234.5, ZIPI),
      entry('expense', 99.9, CHAYA),
      entry('income', 300, CHAYA),
    ],
    admins,
  )

  const moved = new Map<string, number>()
  for (const t of split.transfers) {
    moved.set(t.fromAdminId, (moved.get(t.fromAdminId) ?? 0) - t.amount)
    moved.set(t.toAdminId, (moved.get(t.toAdminId) ?? 0) + t.amount)
  }
  for (const row of split.rows) {
    if (!row.adminId) continue
    const after = row.net + (moved.get(row.adminId) ?? 0)
    assert.ok(
      Math.abs(after - row.entitled) < 0.02,
      `${row.label} ends on ${after}, expected ${row.entitled}`,
    )
  }
})

test('already even books produce no transfers', () => {
  const split = computeAdminSplit(
    [entry('income', 750, ZIPI), entry('income', 750, CHAYA)],
    admins,
  )

  assert.equal(split.fairShare, 750)
  assert.deepEqual(split.transfers, [])
})

test('income share percentages reflect who took the money in', () => {
  const split = computeAdminSplit(
    [entry('income', 750, ZIPI), entry('income', 250, CHAYA)],
    admins,
  )

  assert.equal(split.rows.find((r) => r.adminId === ZIPI)?.incomeShare, 75)
  assert.equal(split.rows.find((r) => r.adminId === CHAYA)?.incomeShare, 25)
})
