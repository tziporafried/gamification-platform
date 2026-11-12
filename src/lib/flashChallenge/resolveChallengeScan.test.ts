import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveChallengeScan, taskCardOnlyMessage } from './resolveChallengeScan.ts'
import { flashBonusReason, pointsForRank, validateFlashDraft, formatClock } from './flashChallenge.ts'

test('a split personal card names the participant', () => {
  assert.deepEqual(resolveChallengeScan('{"participantCode":"P1"}'), { ok: true, participantCode: 'P1' })
})

test('a combined card is read for its participant only', () => {
  // The task half is ignored: the card stays good for its task later on.
  assert.deepEqual(
    resolveChallengeScan('{"participantCode":"P1","actionCode":"A9"}'),
    { ok: true, participantCode: 'P1' },
  )
})

test('a compact (1D) combined card is read the same way', () => {
  assert.deepEqual(resolveChallengeScan('P1*A9'), { ok: true, participantCode: 'P1' })
})

test('a split task card cannot say who is standing there', () => {
  assert.deepEqual(resolveChallengeScan('{"actionCode":"A9"}'), { ok: false, reason: 'TASK_CARD_ONLY' })
  assert.deepEqual(resolveChallengeScan('*A9'), { ok: false, reason: 'TASK_CARD_ONLY' })
})

test('anything else is not a card', () => {
  const warn = console.warn
  console.warn = () => {}
  try {
    assert.deepEqual(resolveChallengeScan('hello'), { ok: false, reason: 'NOT_A_CARD' })
    assert.deepEqual(resolveChallengeScan('{"foo":1}'), { ok: false, reason: 'NOT_A_CARD' })
  } finally {
    console.warn = warn
  }
})

test('the task-card message follows the deck', () => {
  assert.equal(taskCardOnlyMessage('split'), 'סרקו את הכרטיס האישי של המשתתף')
  assert.equal(taskCardOnlyMessage('combined'), 'סרקו כרטיס של המשתתף')
  assert.equal(taskCardOnlyMessage(null), 'סרקו כרטיס של המשתתף')
})

test('the bonus reason is prefixed and fits the column', () => {
  assert.equal(flashBonusReason(' רקדו ריקוד '), '⚡ אתגר בזק: רקדו ריקוד')
  assert.equal(flashBonusReason('א'.repeat(100)).length, 60)
})

test('the podium bonus goes to the first three only', () => {
  const podium = [30, 20, 10]
  assert.deepEqual([0, 1, 2, 3, 7].map((i) => pointsForRank(50, podium, i)), [80, 70, 60, 50, 50])
  assert.equal(pointsForRank(50, undefined, 0), 50)
})

test('a draft needs a title and whole positive points', () => {
  assert.deepEqual(validateFlashDraft({ title: '  ', durationSec: 60, points: '10' }), { ok: false, error: 'NO_TITLE' })
  assert.deepEqual(validateFlashDraft({ title: 'x', durationSec: 60, points: '' }), { ok: false, error: 'NO_POINTS' })
  assert.deepEqual(validateFlashDraft({ title: 'x', durationSec: 60, points: '0' }), { ok: false, error: 'NO_POINTS' })
  assert.deepEqual(validateFlashDraft({ title: 'x', durationSec: 60, points: '20000' }), { ok: false, error: 'POINTS_TOO_HIGH' })
  assert.deepEqual(validateFlashDraft({ title: ' x ', durationSec: 60, points: '25' }), {
    ok: true,
    title: 'x',
    durationSec: 60,
    points: 25,
  })
})

test('the clock reads minutes and seconds', () => {
  assert.equal(formatClock(125), '2:05')
  assert.equal(formatClock(0.2), '0:01')
  assert.equal(formatClock(-3), '0:00')
})
