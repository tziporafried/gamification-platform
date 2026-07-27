import assert from 'node:assert/strict'
import test from 'node:test'
import type { ParticipantLeaderboardEntry } from '@/types'
import {
  emptyCriteria,
  filterEligible,
  isCriteriaIncomplete,
  type EligibilityCriteria,
  type GroupMembership,
} from './lotteryEligibility.ts'

function row(id: string, points: number): ParticipantLeaderboardEntry {
  return {
    participant_id: id,
    participant_name: id.toUpperCase(),
    external_id: id,
    total_points: points,
  } as ParticipantLeaderboardEntry
}

const ROWS = [row('ann', 100), row('bob', 50), row('cat', 0)]

/** ann and bob are in "seniors"; cat is in no group at all. */
const MEMBERSHIP: GroupMembership = new Map([
  ['ann', ['seniors']],
  ['bob', ['seniors', 'rookies']],
])

function criteria(overrides: Partial<EligibilityCriteria> = {}): EligibilityCriteria {
  return { ...emptyCriteria(), ...overrides }
}

function ids(list: { id: string }[]): string[] {
  return list.map((p) => p.id)
}

test('"כולם" takes everyone on the board', () => {
  assert.deepEqual(ids(filterEligible(ROWS, criteria({ mode: 'all' }), MEMBERSHIP)), [
    'ann',
    'bob',
    'cat',
  ])
})

test('the points line is inclusive, exactly as it always was', () => {
  const pool = filterEligible(ROWS, criteria({ mode: 'min_points', minPoints: 50 }), MEMBERSHIP)
  assert.deepEqual(ids(pool), ['ann', 'bob'])
})

test('picking a group takes everyone in it, once', () => {
  const pool = filterEligible(
    ROWS,
    criteria({ mode: 'groups', groupIds: new Set(['seniors']) }),
    MEMBERSHIP,
  )
  assert.deepEqual(ids(pool), ['ann', 'bob'])
})

test('somebody in two chosen groups is still one name in the hat', () => {
  const pool = filterEligible(
    ROWS,
    criteria({ mode: 'groups', groupIds: new Set(['seniors', 'rookies']) }),
    MEMBERSHIP,
  )
  assert.deepEqual(ids(pool), ['ann', 'bob'])
  assert.deepEqual(pool.map((p) => p.entries), [1, 1])
})

test('a player in no group is out when choosing by groups', () => {
  const pool = filterEligible(
    ROWS,
    criteria({ mode: 'groups', groupIds: new Set(['rookies']) }),
    MEMBERSHIP,
  )
  assert.deepEqual(ids(pool), ['bob'])
})

test('no group picked is an unfinished sentence, not an empty lottery', () => {
  // Reported as incomplete so the dock can say "בחרו מי משתתף" rather than
  // "אין זכאים" - a different problem with a different fix.
  assert.ok(isCriteriaIncomplete(criteria({ mode: 'groups' })))
  assert.ok(!isCriteriaIncomplete(criteria({ mode: 'all' })))
  assert.ok(!isCriteriaIncomplete(criteria({ mode: 'min_points' })))
  assert.ok(!isCriteriaIncomplete(criteria({ mode: 'scans' })))
  // And it yields nobody rather than everybody.
  assert.deepEqual(filterEligible(ROWS, criteria({ mode: 'groups' }), MEMBERSHIP), [])
})

test('a scan pool never comes out of the leaderboard', () => {
  // Its tickets are counted in the database from the round's window; filtering
  // here must not quietly hand back the whole board instead.
  assert.deepEqual(filterEligible(ROWS, criteria({ mode: 'scans' }), MEMBERSHIP), [])
})

test('every choice stamps one ticket per person', () => {
  for (const c of [
    criteria({ mode: 'all' }),
    criteria({ mode: 'min_points', minPoints: 0 }),
    criteria({ mode: 'groups', groupIds: new Set(['seniors']) }),
  ]) {
    const pool = filterEligible(ROWS, c, MEMBERSHIP)
    assert.ok(pool.length > 0)
    assert.ok(pool.every((p) => p.entries === 1))
  }
})

test('previous winners are excluded whichever way the pool was chosen', () => {
  const pool = filterEligible(ROWS, criteria({ mode: 'all' }), MEMBERSHIP, new Set(['ann']))
  assert.deepEqual(ids(pool), ['bob', 'cat'])
})
