import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveScan,
  expirePending,
  SPLIT_SCAN_TIMEOUT_MS,
  SCAN_SEQUENCE_MESSAGES,
  type PendingParticipant,
  type ScanOutcome,
} from './scanSequence.ts'

const T0 = 1_700_000_000_000

const participantCard = (code: string) => JSON.stringify({ participantCode: code })
const actionCard = (code: string) => JSON.stringify({ actionCode: code })
const combinedCard = (p: string, a: string) =>
  JSON.stringify({ participantCode: p, actionCode: a })

const armed = (participantCode: string, expiresAt = T0 + SPLIT_SCAN_TIMEOUT_MS):
  PendingParticipant => ({ participantCode, expiresAt })

function scan(
  raw: string,
  opts: { pending?: PendingParticipant | null; now?: number } = {},
): ScanOutcome {
  return resolveScan({ raw, pending: opts.pending ?? null, now: opts.now ?? T0 })
}

/** Feeds cards in order, threading pending state the way the hook does. */
function scanSequence(reads: { raw: string; now?: number }[]): ScanOutcome[] {
  let pending: PendingParticipant | null = null
  return reads.map(({ raw, now }) => {
    const outcome = resolveScan({ raw, pending, now: now ?? T0 })
    pending = outcome.kind === 'armed' ? outcome.pending : outcome.pending ?? null
    return outcome
  })
}

// ─── combined cards score on their own ───────────────────────────────────────

test('a combined card scores in one scan', () => {
  assert.deepEqual(scan(combinedCard('P-1', 'A-1')), {
    kind: 'pair',
    participantCode: 'P-1',
    actionCode: 'A-1',
    pending: null,
  })
})

test('a combined card supersedes a half-scan instead of merging with it', () => {
  const outcome = scan(combinedCard('P-9', 'A-9'), { pending: armed('P-1') })
  assert.deepEqual(outcome, {
    kind: 'pair',
    participantCode: 'P-9',
    actionCode: 'A-9',
    pending: null,
  })
})

// ─── the order is participant first, then action ─────────────────────────────

test('participant then action pairs', () => {
  const outcomes = scanSequence([
    { raw: participantCard('P-1') },
    { raw: actionCard('A-1'), now: T0 + 5_000 },
  ])

  assert.equal(outcomes[0].kind, 'armed')
  assert.deepEqual(outcomes[1], {
    kind: 'pair',
    participantCode: 'P-1',
    actionCode: 'A-1',
    pending: null,
  })
})

test('an action scanned first is refused, not armed', () => {
  const outcome = scan(actionCard('A-1'))
  assert.deepEqual(outcome, {
    kind: 'error',
    message: SCAN_SEQUENCE_MESSAGES.actionBeforeParticipant,
    pending: null,
  })
})

test('the reverse order never pairs - the action is rejected each time', () => {
  const outcomes = scanSequence([
    { raw: actionCard('A-1') },
    { raw: participantCard('P-1'), now: T0 + 1_000 },
  ])

  assert.equal(outcomes[0].kind, 'error')
  // The participant that follows arms a fresh sequence; it must not retroactively
  // pair with the action that was already refused.
  assert.equal(outcomes[1].kind, 'armed')
})

test('a lone participant card never scores on its own', () => {
  assert.equal(scan(participantCard('P-1')).kind, 'armed')
})

test('arming sets the window to the timeout constant', () => {
  const outcome = scan(participantCard('P-1'))
  assert.equal(
    outcome.kind === 'armed' && outcome.pending.expiresAt,
    T0 + SPLIT_SCAN_TIMEOUT_MS,
  )
})

// ─── re-arming and recovery ──────────────────────────────────────────────────

test('rescanning a participant replaces the armed one', () => {
  const outcomes = scanSequence([
    { raw: participantCard('P-1') },
    { raw: participantCard('P-2'), now: T0 + 1_000 },
    { raw: actionCard('A-1'), now: T0 + 2_000 },
  ])

  assert.deepEqual(outcomes[2], {
    kind: 'pair',
    participantCode: 'P-2',
    actionCode: 'A-1',
    pending: null,
  })
})

test('rescanning a participant extends the window rather than expiring early', () => {
  const outcomes = scanSequence([
    { raw: participantCard('P-1') },
    { raw: participantCard('P-2'), now: T0 + 20_000 },
  ])

  assert.equal(
    outcomes[1].kind === 'armed' && outcomes[1].pending.expiresAt,
    T0 + 20_000 + SPLIT_SCAN_TIMEOUT_MS,
  )
})

test('the pair clears, so the next action needs a fresh participant', () => {
  const outcomes = scanSequence([
    { raw: participantCard('P-1') },
    { raw: actionCard('A-1') },
    { raw: actionCard('A-2') },
  ])

  assert.equal(outcomes[1].kind, 'pair')
  assert.equal(outcomes[2].kind, 'error')
})

test('an unreadable read keeps the participant armed', () => {
  const outcomes = scanSequence([
    { raw: participantCard('P-1') },
    { raw: 'garbled', now: T0 + 1_000 },
    { raw: actionCard('A-1'), now: T0 + 2_000 },
  ])

  assert.equal(outcomes[1].kind, 'error')
  assert.deepEqual(outcomes[1].pending, armed('P-1'))
  assert.deepEqual(outcomes[2], {
    kind: 'pair',
    participantCode: 'P-1',
    actionCode: 'A-1',
    pending: null,
  })
})

// ─── the 30-second window ────────────────────────────────────────────────────

test('an action just inside the window still pairs', () => {
  const outcomes = scanSequence([
    { raw: participantCard('P-1') },
    { raw: actionCard('A-1'), now: T0 + SPLIT_SCAN_TIMEOUT_MS - 1 },
  ])
  assert.equal(outcomes[1].kind, 'pair')
})

test('an action past the window is refused, not paired', () => {
  const outcomes = scanSequence([
    { raw: participantCard('P-1') },
    { raw: actionCard('A-1'), now: T0 + SPLIT_SCAN_TIMEOUT_MS + 1 },
  ])

  assert.deepEqual(outcomes[1], {
    kind: 'error',
    message: SCAN_SEQUENCE_MESSAGES.actionBeforeParticipant,
    pending: null,
  })
})

test('an abandoned participant never pairs with the next person’s action card', () => {
  const outcomes = scanSequence([
    { raw: participantCard('P-abandoned') },
    { raw: actionCard('A-1'), now: T0 + 60_000 },
  ])
  assert.notEqual(outcomes[1].kind, 'pair')
})

test('expirePending drops the window exactly at its deadline', () => {
  const pending = armed('P-1', T0 + 1_000)
  assert.deepEqual(expirePending(pending, T0 + 999), pending)
  assert.equal(expirePending(pending, T0 + 1_000), null)
  assert.equal(expirePending(null, T0), null)
})

// ─── malformed input ─────────────────────────────────────────────────────────

test('unparseable text is reported, not armed', () => {
  const outcome = scan('not a qr code')
  assert.equal(outcome.kind, 'error')
  assert.equal(outcome.pending, null)
})

test('a scan scrambled by a Hebrew keyboard layout blames the input mode, not the card', () => {
  // What a scanner delivers for {"participantCode... when the OS input is Hebrew.
  const outcome = scan('ותsirjuproperty...')
  assert.deepEqual(outcome, {
    kind: 'error',
    message: SCAN_SEQUENCE_MESSAGES.hebrewKeyboardLayout,
    pending: null,
  })
})

test('a Hebrew-layout misfire keeps the participant armed like any other unreadable read', () => {
  const outcomes = scanSequence([
    { raw: participantCard('P-1') },
    { raw: ']"participantCode"...', now: T0 + 1_000 },
    { raw: actionCard('A-1'), now: T0 + 2_000 },
  ])

  assert.equal(outcomes[1].kind, 'error')
  assert.equal(
    outcomes[1].kind === 'error' && outcomes[1].message,
    SCAN_SEQUENCE_MESSAGES.hebrewKeyboardLayout,
  )
  assert.deepEqual(outcomes[1].pending, armed('P-1'))
  assert.equal(outcomes[2].kind, 'pair')
})
