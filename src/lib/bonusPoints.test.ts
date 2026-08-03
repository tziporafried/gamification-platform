import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BONUS_MAX_POINTS,
  BONUS_REASON_MAX_LENGTH,
  sanitizeBonusPoints,
  validateBonus,
} from './bonusPoints.ts'

/**
 * What the popup on the scan screen will and will not send.
 *
 * A bonus is the one score in the app with no card, no task and no eligibility
 * check behind it - the operator types all three fields. So these rules are the
 * whole of what stands between a slipped keystroke and an append-only row.
 */

const valid = { participantId: 'p-1', reason: 'עזרה לצוות', points: '30' }

test('all three fields, and it goes', () => {
  const result = validateBonus(valid)
  assert.equal(result.ok, true)
  assert.deepEqual(result, {
    ok: true,
    participantId: 'p-1',
    reason: 'עזרה לצוות',
    points: 30,
  })
})

test('each missing field names itself', () => {
  assert.deepEqual(
    validateBonus({ ...valid, participantId: null }),
    { ok: false, error: 'NO_PARTICIPANT' },
  )
  assert.deepEqual(
    validateBonus({ ...valid, reason: '   ' }),
    { ok: false, error: 'NO_REASON' },
  )
  assert.deepEqual(
    validateBonus({ ...valid, points: '' }),
    { ok: false, error: 'NO_POINTS' },
  )
})

test('a bonus of zero is not a bonus', () => {
  // It would write a row that changes nothing, and the operator would be left
  // wondering why the player's total did not move.
  assert.deepEqual(validateBonus({ ...valid, points: '0' }), { ok: false, error: 'POINTS_NOT_WHOLE' })
})

test('the reason is trimmed, and capped at what the feed can show', () => {
  const trimmed = validateBonus({ ...valid, reason: '  עזרה בהקמה  ' })
  assert.equal(trimmed.ok && trimmed.reason, 'עזרה בהקמה')

  const long = 'א'.repeat(BONUS_REASON_MAX_LENGTH + 20)
  const capped = validateBonus({ ...valid, reason: long })
  assert.equal(capped.ok && capped.reason.length, BONUS_REASON_MAX_LENGTH)
})

test('the cap is what stops a slipped keystroke deciding the game', () => {
  assert.deepEqual(
    validateBonus({ ...valid, points: String(BONUS_MAX_POINTS + 1) }),
    { ok: false, error: 'POINTS_TOO_HIGH' },
  )
  assert.equal(validateBonus({ ...valid, points: String(BONUS_MAX_POINTS) }).ok, true)
})

test('the points box only ever holds digits', () => {
  // Filtered as it is typed rather than validated after, so a minus sign or a
  // decimal point never reaches the field at all.
  assert.equal(sanitizeBonusPoints('-5'), '5')
  assert.equal(sanitizeBonusPoints('2.5'), '25')
  assert.equal(sanitizeBonusPoints('1e3'), '13')
  assert.equal(sanitizeBonusPoints('abc'), '')
})

test('a leading zero is dropped, so 0 then 5 reads as 5', () => {
  assert.equal(sanitizeBonusPoints('05'), '5')
  assert.equal(sanitizeBonusPoints('000'), '0')
})

test('the box cannot hold a number longer than the maximum', () => {
  const typed = sanitizeBonusPoints('9'.repeat(12))
  assert.equal(typed.length, String(BONUS_MAX_POINTS).length)
  // And what fits is still refused if it is over the cap, so the length limit
  // is a convenience rather than the rule.
  assert.deepEqual(validateBonus({ ...valid, points: typed }), { ok: false, error: 'POINTS_TOO_HIGH' })
})
