import assert from 'node:assert/strict'
import test from 'node:test'
import { computeCardCounts, isActionRelevantTo } from './cardCounts.ts'

const p = (...groupIds: string[]) => ({ groupIds })
const a = (...groupIds: string[]) => ({ groupIds })

test('with no group targeting the combined deck is participants × actions', () => {
  const counts = computeCardCounts([p(), p(), p()], [a(), a()])
  assert.deepEqual(counts, { combined: 6, split: 5, participantCards: 3, actionCards: 2, triviaTasks: 0, triviaCards: 0 })
})

test('the split deck is reported as its two halves, and they add up', () => {
  const counts = computeCardCounts([p(), p('g1'), p('g2')], [a(), a('g1')])
  assert.equal(counts.participantCards, 3)
  assert.equal(counts.actionCards, 2)
  assert.equal(counts.split, counts.participantCards + counts.actionCards)
})

test('a group-restricted action only prints for members - not for everyone', () => {
  // The bug this replaced: a flat 3 × 2 would have claimed 6 cards.
  const counts = computeCardCounts(
    [p('g1'), p('g2'), p('g2')],
    [a(), a('g1')],
  )

  // Open action → 3 cards. Restricted action → only the one g1 member.
  assert.equal(counts.combined, 4)
})

test('a participant in no group still gets the open actions', () => {
  const counts = computeCardCounts([p()], [a(), a('g1')])
  assert.equal(counts.combined, 1)
})

test('a participant sharing one of several groups still qualifies', () => {
  const counts = computeCardCounts([p('g2')], [a('g1', 'g2', 'g3')])
  assert.equal(counts.combined, 1)
})

test('an action targeting a group nobody is in prints nothing', () => {
  const counts = computeCardCounts([p('g1'), p('g2')], [a('g9')])
  assert.equal(counts.combined, 0)
  // It still gets its own card in the split deck - it is a real action.
  assert.equal(counts.split, 3)
})

test('the split deck is unaffected by group targeting', () => {
  const wideOpen = computeCardCounts([p(), p(), p()], [a(), a()])
  const targeted = computeCardCounts([p('g1'), p('g2'), p('g3')], [a('g1'), a('g2')])
  assert.equal(wideOpen.split, targeted.split)
})

test('split beats combined exactly when targeting is loose enough', () => {
  const counts = computeCardCounts([p(), p(), p(), p()], [a(), a(), a()])
  assert.equal(counts.combined, 12)
  assert.equal(counts.split, 7)
})

test('empty inputs count as zero, not NaN', () => {
  assert.deepEqual(computeCardCounts([], []), { combined: 0, split: 0, participantCards: 0, actionCards: 0, triviaTasks: 0, triviaCards: 0 })
  assert.deepEqual(computeCardCounts([p()], []), { combined: 0, split: 1, participantCards: 1, actionCards: 0, triviaTasks: 0, triviaCards: 0 })
  assert.deepEqual(computeCardCounts([], [a()]), { combined: 0, split: 1, participantCards: 0, actionCards: 1, triviaTasks: 0, triviaCards: 0 })
})

test('isActionRelevantTo: open actions match anyone', () => {
  assert.equal(isActionRelevantTo(a(), new Set()), true)
  assert.equal(isActionRelevantTo(a(), new Set(['g1'])), true)
})

test('isActionRelevantTo: restricted actions need a shared group', () => {
  assert.equal(isActionRelevantTo(a('g1'), new Set(['g1'])), true)
  assert.equal(isActionRelevantTo(a('g1'), new Set(['g2'])), false)
  assert.equal(isActionRelevantTo(a('g1'), new Set()), false)
})

// ── Trivia questions print a card per answer (088) ───────────────────────────

/** A question: open to everyone unless groups are named, three answer cards. */
const q = (...groupIds: string[]) => ({ groupIds, cardCount: 3 })

test('a question costs three cards in the split deck, once', () => {
  const counts = computeCardCounts([p(), p(), p()], [a(), q()])
  assert.equal(counts.actionCards, 4)
  assert.equal(counts.split, 7)
  assert.equal(counts.triviaTasks, 1)
  assert.equal(counts.triviaCards, 3)
})

test('a question costs three cards per participant in the combined deck', () => {
  // This is the number the cards step has to warn about: 3 players × 1 question
  // is 9 combined cards against 6 split ones, and it diverges from there.
  const counts = computeCardCounts([p(), p(), p()], [q()])
  assert.equal(counts.combined, 9)
  assert.equal(counts.split, 6)
})

test('group targeting still applies to a question', () => {
  const counts = computeCardCounts([p('g1'), p('g2')], [q('g1')])
  assert.equal(counts.combined, 3)
})

test('a task that never states a card count is a one-card task', () => {
  assert.equal(computeCardCounts([p()], [a()]).combined, 1)
  assert.equal(computeCardCounts([p()], [a()]).triviaTasks, 0)
})
