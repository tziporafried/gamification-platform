import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import {
  addScanLotteryEntry,
  clearScanLottery,
  closeScanLottery,
  loadScanLottery,
  openScanLottery,
  statusOf,
} from './scanLotteryStore.ts'

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
let cells: Map<string, string>

beforeEach(() => {
  cells = installStorage()
})

test('a game that has collected nothing has nothing to resume', () => {
  assert.equal(loadScanLottery(EVENT), null)
  assert.equal(statusOf(null), 'idle')
})

test('opening starts an empty, open collection', () => {
  const open = openScanLottery(EVENT)
  assert.equal(statusOf(open), 'open')
  assert.deepEqual(open.participants, [])
})

test('scanning someone in puts them in the hat once', () => {
  openScanLottery(EVENT)
  assert.deepEqual(addScanLotteryEntry(EVENT, { id: 'ann', name: 'אן' }), { added: true })

  const pool = loadScanLottery(EVENT)!
  assert.deepEqual(pool.participants.map((p) => p.id), ['ann'])
  assert.deepEqual(pool.participants.map((p) => p.entries), [1])
})

test('scanning the same person again adds nothing', () => {
  openScanLottery(EVENT)
  addScanLotteryEntry(EVENT, { id: 'ann', name: 'אן' })

  // The cap, and the answer the stage turns into "כבר בהגרלה".
  assert.deepEqual(addScanLotteryEntry(EVENT, { id: 'ann', name: 'אן' }), { added: false })
  assert.equal(loadScanLottery(EVENT)!.participants.length, 1)
})

test('a scan after closing is refused', () => {
  openScanLottery(EVENT)
  addScanLotteryEntry(EVENT, { id: 'ann', name: 'אן' })
  closeScanLottery(EVENT)

  // Closing the lottery has to mean closed, even for a card read a moment late.
  assert.deepEqual(addScanLotteryEntry(EVENT, { id: 'bob', name: 'בוב' }), { added: false })
})

test('closing twice does not move the cutoff', () => {
  openScanLottery(EVENT)
  addScanLotteryEntry(EVENT, { id: 'ann', name: 'אן' })
  const first = closeScanLottery(EVENT)!
  const second = closeScanLottery(EVENT)!
  assert.equal(second.closedAt, first.closedAt)
})

test('a closed collection is history, not something to resume', () => {
  openScanLottery(EVENT)
  addScanLotteryEntry(EVENT, { id: 'ann', name: 'אן' })
  closeScanLottery(EVENT)

  // Setting up the next lottery starts from nothing, rather than from the
  // finished pool of the last one.
  assert.equal(loadScanLottery(EVENT), null)
})

test('an open collection with people in it survives a refresh', () => {
  openScanLottery(EVENT)
  addScanLotteryEntry(EVENT, { id: 'ann', name: 'אן' })
  addScanLotteryEntry(EVENT, { id: 'bob', name: 'בוב' })

  // Same storage, fresh read - what a reload does.
  const resumed = loadScanLottery(EVENT)!
  assert.equal(statusOf(resumed), 'open')
  assert.deepEqual(resumed.participants.map((p) => p.name), ['אן', 'בוב'])
})

test('an open collection nobody scanned into is swept away', () => {
  openScanLottery(EVENT)
  // Only this screen can add to it, so one left open by an earlier visit was
  // never collecting - and resuming it is what kept the button saying
  // "המשיכו לאסוף".
  assert.equal(loadScanLottery(EVENT), null)
  assert.equal(cells.size, 0)
})

test('"הגרלה חדשה" throws the collection away', () => {
  openScanLottery(EVENT)
  addScanLotteryEntry(EVENT, { id: 'ann', name: 'אן' })
  clearScanLottery(EVENT)
  assert.equal(loadScanLottery(EVENT), null)
})

test('two games collect separately', () => {
  openScanLottery(EVENT)
  addScanLotteryEntry(EVENT, { id: 'ann', name: 'אן' })
  openScanLottery('event-2')
  addScanLotteryEntry('event-2', { id: 'bob', name: 'בוב' })

  assert.deepEqual(loadScanLottery(EVENT)!.participants.map((p) => p.id), ['ann'])
  assert.deepEqual(loadScanLottery('event-2')!.participants.map((p) => p.id), ['bob'])
})

test('unreadable storage reads as nothing collected', () => {
  cells.set('lottery-scan:event-1', 'not json')
  assert.equal(loadScanLottery(EVENT), null)
})
