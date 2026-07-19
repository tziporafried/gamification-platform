import assert from 'node:assert/strict'
import test from 'node:test'
import { parseQrPayload } from './qrPayload'

test('reads a combined card (participant + action in one code)', () => {
  const result = parseQrPayload(JSON.stringify({ participantCode: 'P-1', actionCode: 'A-1' }))
  assert.deepEqual(result, {
    ok: true,
    data: { kind: 'combined', participantCode: 'P-1', actionCode: 'A-1' },
  })
})

test('reads a participant-only card', () => {
  const result = parseQrPayload(JSON.stringify({ participantCode: 'P-1' }))
  assert.deepEqual(result, { ok: true, data: { kind: 'participant', participantCode: 'P-1' } })
})

test('reads an action-only card', () => {
  const result = parseQrPayload(JSON.stringify({ actionCode: 'A-1' }))
  assert.deepEqual(result, { ok: true, data: { kind: 'action', actionCode: 'A-1' } })
})

test('tolerates a BOM and surrounding scanner noise', () => {
  const result = parseQrPayload('﻿  junk{"participantCode":"P-1"}trailing ')
  assert.deepEqual(result, { ok: true, data: { kind: 'participant', participantCode: 'P-1' } })
})

test('trims whitespace inside the codes', () => {
  const result = parseQrPayload(JSON.stringify({ participantCode: ' P-1 ', actionCode: ' A-1 ' }))
  assert.deepEqual(result, {
    ok: true,
    data: { kind: 'combined', participantCode: 'P-1', actionCode: 'A-1' },
  })
})

test('a blank code counts as absent, not as a half-card', () => {
  const result = parseQrPayload(JSON.stringify({ participantCode: 'P-1', actionCode: '   ' }))
  assert.deepEqual(result, { ok: true, data: { kind: 'participant', participantCode: 'P-1' } })
})

test('rejects unparseable text', () => {
  const result = parseQrPayload('not json at all')
  assert.equal(result.ok, false)
})

test('rejects an object carrying neither code', () => {
  const result = parseQrPayload(JSON.stringify({ somethingElse: 'x' }))
  assert.equal(result.ok, false)
})

test('rejects non-string code values', () => {
  const result = parseQrPayload(JSON.stringify({ participantCode: 42, actionCode: null }))
  assert.equal(result.ok, false)
})
