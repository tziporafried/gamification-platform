import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPhone, normalizePhone, parsePhone } from './phone.ts'

test('the way an Israeli mobile is actually typed all lands on one number', () => {
  for (const written of [
    '0501234567',
    '050-1234567',
    '050 123 4567',
    ' 050-123-4567 ',
    '(050) 1234567',
    '+972501234567',
    '+972-50-123-4567',
    '972501234567',
    '00972501234567',
    '+972 (0)50 123 4567',
  ]) {
    assert.equal(normalizePhone(written), '+972501234567', written)
  }
})

test('a spreadsheet that ate the leading zero still gives a usable number', () => {
  assert.equal(normalizePhone('501234567'), '+972501234567')
})

test('every Israeli mobile prefix is accepted, not just the common ones', () => {
  for (const prefix of ['050', '051', '052', '053', '054', '055', '056', '057', '058', '059']) {
    assert.equal(normalizePhone(`${prefix}-7654321`), `+972${prefix.slice(1)}7654321`, prefix)
  }
})

test('a landline is refused as a landline, not as a typo', () => {
  assert.deepEqual(parsePhone('03-1234567'), { e164: null, error: 'NOT_MOBILE' })
  assert.deepEqual(parsePhone('09-8765432'), { e164: null, error: 'NOT_MOBILE' })
  assert.deepEqual(parsePhone('077-1234567'), { e164: null, error: 'NOT_MOBILE' })
})

test('a number missing or gaining a digit is refused as the wrong length', () => {
  assert.equal(parsePhone('050-123456').error, 'TOO_SHORT')
  assert.equal(parsePhone('050-12345678').error, 'TOO_LONG')
})

test('nothing typed is its own answer, so a blank field is not an error to show', () => {
  assert.equal(parsePhone('').error, 'EMPTY')
  assert.equal(parsePhone('   ').error, 'EMPTY')
  assert.equal(parsePhone(null).error, 'EMPTY')
  assert.equal(parsePhone(undefined).error, 'EMPTY')
})

test('text where a number should be is refused', () => {
  assert.equal(parsePhone('אין לו טלפון').error, 'MALFORMED')
  assert.equal(parsePhone('050-1234567 (אמא)').error, 'MALFORMED')
})

test('a foreign number keeps its own country code', () => {
  assert.equal(normalizePhone('+1 415 555 2671'), '+14155552671')
  assert.equal(normalizePhone('+44 7700 900123'), '+447700900123')
  assert.equal(normalizePhone('001 415 555 2671'), '+14155552671')
})

test('a foreign number is only length-checked - we do not guess foreign mobile prefixes', () => {
  assert.equal(normalizePhone('+33 1 42 68 53 00'), '+33142685300')
  assert.equal(parsePhone('+1 415').error, 'TOO_SHORT')
  assert.equal(parsePhone('+1 415555267112345').error, 'TOO_LONG')
})

test('a stored number reads back the way it is written here', () => {
  assert.equal(formatPhone('+972501234567'), '050-123-4567')
  assert.equal(formatPhone('+14155552671'), '+14155552671')
  assert.equal(formatPhone(null), '')
})

test('normalising twice changes nothing - rows re-imported keep one shape', () => {
  const once = normalizePhone('050-1234567')!
  assert.equal(normalizePhone(once), once)
  assert.equal(normalizePhone(formatPhone(once)), once)
})
