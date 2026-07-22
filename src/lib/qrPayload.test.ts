import assert from 'node:assert/strict'
import test from 'node:test'
import { parseQrPayload } from './qrPayload'
import { encodeCardPayload } from './cardPayload'

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

// ── One-dimensional (Code128) compact payloads ──────────────────────────────

test('reads a combined 1D card (participant*action)', () => {
  const result = parseQrPayload('P-1001*A-1001')
  assert.deepEqual(result, {
    ok: true,
    data: { kind: 'combined', participantCode: 'P-1001', actionCode: 'A-1001' },
  })
})

test('reads a participant-only 1D card (trailing separator)', () => {
  const result = parseQrPayload('P-1001*')
  assert.deepEqual(result, { ok: true, data: { kind: 'participant', participantCode: 'P-1001' } })
})

test('reads an action-only 1D card (leading separator)', () => {
  const result = parseQrPayload('*A-1001')
  assert.deepEqual(result, { ok: true, data: { kind: 'action', actionCode: 'A-1001' } })
})

test('tolerates a terminator newline on a 1D scan', () => {
  const result = parseQrPayload('P-1001*A-1001\r\n')
  assert.deepEqual(result, {
    ok: true,
    data: { kind: 'combined', participantCode: 'P-1001', actionCode: 'A-1001' },
  })
})

test('rejects a bare separator with no codes', () => {
  const result = parseQrPayload('*')
  assert.equal(result.ok, false)
})

test('every code128 payload round-trips back through the parser', () => {
  const cases = [
    { participantCode: 'P-1001', actionCode: 'A-1001' },
    { participantCode: 'P-1001' },
    { actionCode: 'A-1001' },
  ] as const
  for (const payload of cases) {
    const encoded = encodeCardPayload(payload, 'code128')
    const result = parseQrPayload(encoded)
    assert.equal(result.ok, true)
    if (result.ok) {
      if ('participantCode' in payload && 'actionCode' in payload) {
        assert.deepEqual(result.data, { kind: 'combined', ...payload })
      } else if ('participantCode' in payload) {
        assert.deepEqual(result.data, { kind: 'participant', ...payload })
      } else {
        assert.deepEqual(result.data, { kind: 'action', ...payload })
      }
    }
  }
})
