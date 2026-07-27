import assert from 'node:assert/strict'
import test from 'node:test'
import type { EligibleParticipant, LotteryConfig } from '../types.ts'
import {
  DEFAULT_ELIGIBILITY_MODE,
  availableEligibilityModes,
  configLotteryMode,
  entryCount,
  modeForEligibility,
  poolCountLabel,
  poolDescription,
  resolveEligibilityMode,
  totalEntries,
} from './lotteryMode.ts'
import { pickRandomWinner } from './lotteryUtils.ts'

function player(id: string, entries?: number): EligibleParticipant {
  return { id, name: id, points: 0, entries }
}

function config(overrides: Partial<LotteryConfig> = {}): LotteryConfig {
  return {
    kind: 'lottery',
    eventId: 'e1',
    eligibilityMode: 'all',
    minPoints: 0,
    prizeName: 'פרס',
    prizeIcon: '🎁',
    ...overrides,
  }
}

test('the flag adds a toggle, it never removes one', () => {
  const without = availableEligibilityModes(false)
  const with_ = availableEligibilityModes(true)
  assert.deepEqual(without, ['all', 'min_points', 'groups'])
  assert.deepEqual(with_, ['all', 'min_points', 'scans', 'groups'])
  // Everything offered without the flag is still offered with it.
  for (const mode of without) assert.ok(with_.includes(mode))
})

test('the dock opens on "כולם" either way', () => {
  // A game where the flag was just switched on must still open on the dock it
  // opened on yesterday - the scan lottery is an extra, not a new default.
  assert.equal(DEFAULT_ELIGIBILITY_MODE, 'all')
  assert.equal(resolveEligibilityMode('scans', true), 'scans')
  assert.equal(resolveEligibilityMode('groups', false), 'groups')
})

test('a choice the game may not make falls back to "כולם"', () => {
  // The flag withdrawn mid-session, or a stale choice: never leave the dock on
  // a toggle this game has not been sold.
  assert.equal(resolveEligibilityMode('scans', false), 'all')
})

test('only the scan toggle changes what a ticket is', () => {
  assert.equal(modeForEligibility('scans'), 'scan')
  for (const mode of ['all', 'min_points', 'groups'] as const) {
    assert.equal(modeForEligibility(mode), 'points')
  }
})

test('a config with no mode is a points lottery', () => {
  // Sessions saved before the scan lottery shipped must keep behaving as they
  // did - there is no mode on them, and they are all points lotteries.
  assert.equal(configLotteryMode(config()), 'points')
  assert.equal(configLotteryMode(config({ mode: 'points' })), 'points')
  assert.equal(configLotteryMode(config({ mode: 'scan' })), 'scan')
})

test('an unstamped participant holds exactly one ticket', () => {
  assert.equal(entryCount(player('a')), 1)
  assert.equal(entryCount({ entries: undefined }), 1)
  assert.equal(entryCount({ entries: 15 }), 15)
  // Nothing that came off the wire can hand out negative or fractional odds.
  assert.equal(entryCount({ entries: -3 }), 0)
  assert.equal(entryCount({ entries: 2.7 }), 2)
  assert.equal(entryCount({ entries: Number.NaN }), 1)
})

test('a points pool has as many tickets as it has players', () => {
  const pool = [player('a', 1), player('b', 1), player('c', 1)]
  assert.equal(totalEntries(pool), pool.length)
})

test('a scan pool is one ticket per participant', () => {
  // The cap lives in the database (081); this just checks the client adds up
  // whatever ticket counts it is handed.
  assert.equal(totalEntries([player('a', 1), player('b', 1), player('c', 1)]), 3)
})

test('the pool description states whichever rule was chosen', () => {
  assert.equal(poolDescription(config({ eligibilityMode: 'all' })), 'כל המשתתפים')
  assert.match(poolDescription(config({ eligibilityMode: 'min_points', minPoints: 50 })), /50/)
  assert.equal(
    poolDescription(config({ mode: 'scan', eligibilityMode: 'scans' })),
    'כל מי שנסרק להגרלה',
  )
  assert.match(poolDescription(config({ eligibilityMode: 'groups', groupIds: ['g'] })), /^1 /)
})

test('a written pool label wins over the rule', () => {
  // The dock knows the group names; the show should read them out rather than
  // fall back to counting them.
  assert.equal(
    poolDescription(config({ eligibilityMode: 'groups', groupIds: ['g'], poolLabel: 'בוגרים' })),
    'בוגרים',
  )
  // Whitespace is not a label - fall through to the rule rather than print it.
  assert.equal(poolDescription(config({ eligibilityMode: 'all', poolLabel: '  ' })), 'כל המשתתפים')
})

test('the launch button names the pool by how it was chosen', () => {
  const pool = [player('a', 1), player('b', 1)]
  assert.match(poolCountLabel('points', pool), /^2 זכאים/)
  assert.match(poolCountLabel('scan', pool), /^2 משתתפים/)
})

// ─── the draw ───────────────────────────────────────────────────────────────

/** Replaces Math.random with a fixed sequence, so a draw can be asserted. */
function withRandom<T>(values: number[], fn: () => T): T {
  const original = Math.random
  let i = 0
  Math.random = () => values[Math.min(i++, values.length - 1)]!
  try {
    return fn()
  } finally {
    Math.random = original
  }
}

test('a points draw is still the uniform pick it always was', () => {
  const pool = [player('a', 1), player('b', 1), player('c', 1), player('d', 1)]
  // floor(r * 4) is the index the old implementation used directly.
  assert.equal(withRandom([0], () => pickRandomWinner(pool)).id, 'a')
  assert.equal(withRandom([0.26], () => pickRandomWinner(pool)).id, 'b')
  assert.equal(withRandom([0.51], () => pickRandomWinner(pool)).id, 'c')
  assert.equal(withRandom([0.99], () => pickRandomWinner(pool)).id, 'd')
})

test('a scan draw walks tickets, not people', () => {
  // 15 tickets for a, 1 for b, 4 for c - 20 in all.
  const pool = [player('a', 15), player('b', 1), player('c', 4)]
  assert.equal(withRandom([0], () => pickRandomWinner(pool)).id, 'a')
  assert.equal(withRandom([14 / 20], () => pickRandomWinner(pool)).id, 'a')
  assert.equal(withRandom([15 / 20], () => pickRandomWinner(pool)).id, 'b')
  assert.equal(withRandom([16 / 20], () => pickRandomWinner(pool)).id, 'c')
  assert.equal(withRandom([0.999], () => pickRandomWinner(pool)).id, 'c')
})

test('a heavier ticket count wins proportionally more often', () => {
  // No pool the app builds today is weighted - every ticket count is 1 - but
  // the draw stays a ticket walk so that cap remains a policy in one query
  // rather than an assumption baked into the shuffle.
  const pool = [player('heavy', 15), player('light', 1)]
  let heavy = 0
  for (let i = 0; i < 16_000; i++) {
    if (pickRandomWinner(pool).id === 'heavy') heavy += 1
  }
  const share = heavy / 16_000
  assert.ok(share > 0.9 && share < 0.98, `expected ~15/16 of draws, got ${share}`)
})

test('a pool with no tickets left still returns somebody', () => {
  // Not reachable through the dock (it refuses to launch an empty pool), but
  // the show must never be handed undefined mid-ceremony.
  const pool = [player('a', 0), player('b', 0)]
  assert.ok(['a', 'b'].includes(pickRandomWinner(pool).id))
})
