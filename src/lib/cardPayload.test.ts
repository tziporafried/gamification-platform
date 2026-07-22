import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeCardPayload, COMPACT_SEPARATOR } from './cardPayload'

test('qr events keep encoding the JSON payload verbatim', () => {
  assert.equal(
    encodeCardPayload({ participantCode: 'P-1001', actionCode: 'A-1001' }, 'qr'),
    '{"participantCode":"P-1001","actionCode":"A-1001"}',
  )
  assert.equal(encodeCardPayload({ participantCode: 'P-1001' }, 'qr'), '{"participantCode":"P-1001"}')
  assert.equal(encodeCardPayload({ actionCode: 'A-1001' }, 'qr'), '{"actionCode":"A-1001"}')
})

test('code128 combined card joins both codes with a single separator', () => {
  assert.equal(
    encodeCardPayload({ participantCode: 'P-1001', actionCode: 'A-1001' }, 'code128'),
    'P-1001*A-1001',
  )
})

test('code128 single-code cards leave the missing half empty', () => {
  assert.equal(encodeCardPayload({ participantCode: 'P-1001' }, 'code128'), 'P-1001*')
  assert.equal(encodeCardPayload({ actionCode: 'A-1001' }, 'code128'), '*A-1001')
})

test('every code128 payload carries exactly one separator', () => {
  const encodings = [
    encodeCardPayload({ participantCode: 'P-1001', actionCode: 'A-1001' }, 'code128'),
    encodeCardPayload({ participantCode: 'P-1001' }, 'code128'),
    encodeCardPayload({ actionCode: 'A-1001' }, 'code128'),
  ]
  for (const enc of encodings) {
    assert.equal(enc.split(COMPACT_SEPARATOR).length, 2)
  }
})
