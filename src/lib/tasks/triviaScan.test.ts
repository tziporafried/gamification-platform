import test from 'node:test'
import assert from 'node:assert/strict'
import { actionKind, isCorrectScan, isTriviaAction, scanPoints } from './triviaScan.ts'

/**
 * What a scanned answer card is worth.
 *
 * These rules used to be exercised only through the exported game's own scoring
 * engine. That engine is gone - the downloaded game runs the real kiosk - so
 * they are asked here directly, of the file both scanning paths call.
 */

const right = { id: 'o-1', label: '1948', is_correct: true }
const wrong = { id: 'o-2', label: '1952', is_correct: false }

test('a task with no kind is a standard one', () => {
  // Every task written before 088 has no kind at all, and so does any query
  // that lists columns instead of asking for them all.
  assert.equal(actionKind({ kind: undefined }), 'standard')
  assert.equal(actionKind({} as { kind?: undefined }), 'standard')
  assert.equal(isTriviaAction({ kind: undefined }), false)
  assert.equal(isTriviaAction({ kind: 'trivia' }), true)
})

test('the correct card scores the task points', () => {
  assert.equal(isCorrectScan(right), true)
  assert.equal(scanPoints(20, right), 20)
})

test('a wrong card scores 0 - not the points, and not a penalty', () => {
  assert.equal(isCorrectScan(wrong), false)
  assert.equal(scanPoints(20, wrong), 0)
})

test('a standard scan has no answer to be wrong about', () => {
  assert.equal(isCorrectScan(null), true)
  assert.equal(scanPoints(15, null), 15)
})
