import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import {
  addFlashCompletion,
  clearFlashChallenge,
  closeFlashChallenge,
  extendFlashChallenge,
  loadFlashChallenge,
  openFlashChallenge,
  remainingMs,
  statusOf,
  totalAwarded,
} from './flashChallengeStore.ts'

/** The two methods the store touches, backed by a plain map. */
function installStorage(): Map<string, string> {
  const cells = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => cells.get(k) ?? null,
    setItem: (k: string, v: string) => void cells.set(k, v),
    removeItem: (k: string) => void cells.delete(k),
  }
  return cells
}

const EVENT = 'event-1'
const T0 = Date.parse('2026-12-01T18:00:00.000Z')
const DRAFT = { title: 'הביאו משהו כחול', durationSec: 60, points: 50 }
let cells: Map<string, string>

const ann = { participantId: 'ann', name: 'אן', points: 50, transactionId: 'tx-1' }
const bob = { participantId: 'bob', name: 'בוב', points: 50, transactionId: 'tx-2' }

beforeEach(() => {
  cells = installStorage()
})

test('a game with no challenge has nothing to resume', () => {
  assert.equal(loadFlashChallenge(EVENT), null)
})

test('opening starts a running challenge with an empty list', () => {
  const c = openFlashChallenge(EVENT, DRAFT, T0)
  assert.equal(statusOf(c, T0 + 1000), 'open')
  assert.equal(remainingMs(c, T0 + 1000), 59_000)
  assert.deepEqual(c.completions, [])
})

test('completers are kept in the order they arrived', () => {
  const c = openFlashChallenge(EVENT, DRAFT, T0)
  const first = addFlashCompletion(EVENT, c.id, ann, T0 + 5_000)
  const second = addFlashCompletion(EVENT, c.id, bob, T0 + 9_000)
  assert.equal(first.added && first.rank, 1)
  assert.equal(second.added && second.rank, 2)
  assert.deepEqual(loadFlashChallenge(EVENT)!.completions.map((x) => x.name), ['אן', 'בוב'])
})

test('the same participant completes once', () => {
  const c = openFlashChallenge(EVENT, DRAFT, T0)
  addFlashCompletion(EVENT, c.id, ann, T0 + 5_000)
  assert.deepEqual(addFlashCompletion(EVENT, c.id, ann, T0 + 6_000), { added: false, reason: 'duplicate' })
  assert.equal(loadFlashChallenge(EVENT)!.completions.length, 1)
})

test('the challenge closes on its own when the clock runs out', () => {
  const c = openFlashChallenge(EVENT, DRAFT, T0)
  assert.equal(statusOf(c, T0 + 59_999), 'open')
  assert.equal(statusOf(c, T0 + 60_000), 'closed')
  assert.deepEqual(addFlashCompletion(EVENT, c.id, ann, T0 + 60_000), { added: false, reason: 'closed' })
})

test('a scan read before the cutoff counts even if it lands after', () => {
  const c = openFlashChallenge(EVENT, DRAFT, T0)
  // The timer fires and closes while the award is still in flight.
  closeFlashChallenge(EVENT, T0 + 61_000)
  const late = addFlashCompletion(EVENT, c.id, ann, T0 + 59_500)
  assert.equal(late.added, true)
})

test('a late timer still records the end of the clock as the close', () => {
  openFlashChallenge(EVENT, DRAFT, T0)
  const closed = closeFlashChallenge(EVENT, T0 + 3_600_000)!
  assert.equal(closed.closedAt, new Date(T0 + 60_000).toISOString())
})

test('closing early stops scans from that moment', () => {
  const c = openFlashChallenge(EVENT, DRAFT, T0)
  closeFlashChallenge(EVENT, T0 + 20_000)
  const after = loadFlashChallenge(EVENT)!
  assert.equal(statusOf(after, T0 + 21_000), 'closed')
  assert.deepEqual(addFlashCompletion(EVENT, c.id, ann, T0 + 21_000), { added: false, reason: 'closed' })
})

test('closing twice keeps the first cutoff', () => {
  openFlashChallenge(EVENT, DRAFT, T0)
  const first = closeFlashChallenge(EVENT, T0 + 10_000)!
  const second = closeFlashChallenge(EVENT, T0 + 30_000)!
  assert.equal(second.closedAt, first.closedAt)
})

test('+30 seconds extends a running challenge only', () => {
  openFlashChallenge(EVENT, DRAFT, T0)
  const extended = extendFlashChallenge(EVENT, 30, T0 + 50_000)!
  assert.equal(remainingMs(extended, T0 + 50_000), 40_000)

  closeFlashChallenge(EVENT, T0 + 55_000)
  const after = extendFlashChallenge(EVENT, 30, T0 + 56_000)!
  assert.equal(statusOf(after, T0 + 56_000), 'closed')
})

test('a reload mid-challenge resumes the same clock and completers', () => {
  const c = openFlashChallenge(EVENT, DRAFT, T0)
  addFlashCompletion(EVENT, c.id, ann, T0 + 5_000)
  const resumed = loadFlashChallenge(EVENT)!
  assert.equal(resumed.id, c.id)
  assert.equal(statusOf(resumed, T0 + 30_000), 'open')
  assert.equal(remainingMs(resumed, T0 + 30_000), 30_000)
  assert.equal(resumed.completions.length, 1)
})

test('a reload after the end shows the finished challenge, not a reopened one', () => {
  const c = openFlashChallenge(EVENT, DRAFT, T0)
  addFlashCompletion(EVENT, c.id, ann, T0 + 5_000)
  // Tab closed during the challenge, reopened long after - closedAt never written.
  const later = loadFlashChallenge(EVENT)!
  assert.equal(statusOf(later, T0 + 600_000), 'closed')
  assert.equal(totalAwarded(later), 50)
})

test('a completion for a challenge that was replaced is dropped', () => {
  const old = openFlashChallenge(EVENT, DRAFT, T0)
  openFlashChallenge(EVENT, DRAFT, T0 + 1_000)
  assert.deepEqual(addFlashCompletion(EVENT, old.id, ann, T0 + 2_000), { added: false, reason: 'missing' })
})

test('"אתגר חדש" throws the challenge away', () => {
  openFlashChallenge(EVENT, DRAFT, T0)
  clearFlashChallenge(EVENT)
  assert.equal(loadFlashChallenge(EVENT), null)
  assert.equal(cells.size, 0)
})

test('two games keep separate challenges', () => {
  openFlashChallenge(EVENT, DRAFT, T0)
  openFlashChallenge('event-2', { ...DRAFT, title: 'אחר' }, T0)
  assert.equal(loadFlashChallenge(EVENT)!.title, 'הביאו משהו כחול')
  assert.equal(loadFlashChallenge('event-2')!.title, 'אחר')
})

test('unreadable storage reads as no challenge', () => {
  cells.set('flash-challenge:event-1', 'not json')
  assert.equal(loadFlashChallenge(EVENT), null)
})
