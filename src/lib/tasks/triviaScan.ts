/**
 * What a scanned trivia answer is worth, and what a scan that is not one means.
 *
 * The rules live here rather than in the hook so that scoring is one answer,
 * asked the same way wherever a card is read. `useScoreSubmit` resolves a code
 * in two steps and then asks this file what the scan is worth:
 *
 *   1. a task whose `code` matches   -> a standard scan, as it has always been
 *   2. otherwise an answer whose `code` matches -> the task it belongs to
 *
 * Step 2 only runs when step 1 found nothing, so a game with no trivia in it
 * pays nothing for this.
 *
 * The exported offline game runs that same hook over the supabase shim, which
 * is why the rules below have to hold with no network behind them.
 */

/**
 * Nothing in this file may import from `triviaTasksFlag.ts`: that module reads a
 * feature flag through a React context, and scanning is deliberately not gated
 * on the flag - a printed deck must stay readable after the flag is withdrawn,
 * and a downloaded game resolves every flag off. Pure functions only.
 */

import type { Action, ActionKind } from '@/types'

/** The answer half of a resolved scan. `null` when a standard task was scanned. */
export interface ScannedOption {
  id: string
  label: string
  is_correct: boolean
}

/**
 * A task with no `kind` is a standard one - which covers every task written
 * before 088, and every query that lists its columns instead of asking for all
 * of them. Read the kind through here rather than comparing the field.
 */
export function actionKind(action: Pick<Action, 'kind'>): ActionKind {
  return action.kind === 'trivia' ? 'trivia' : 'standard'
}

export function isTriviaAction(action: Pick<Action, 'kind'>): boolean {
  return actionKind(action) === 'trivia'
}

/**
 * Was this scan right?
 *
 * A standard task has no answer to be wrong about, so it is always true - which
 * is what lets every caller read `isCorrect` without asking what kind of task it
 * was first.
 */
export function isCorrectScan(option: ScannedOption | null): boolean {
  return option === null || option.is_correct
}

/**
 * What the scan scores.
 *
 * A wrong answer is worth 0 - not the task's points, and not a penalty. It is
 * still written to point_transactions, and that row is the entire reason the
 * "one attempt" rule holds: max_completions counts it, so the other two answer
 * cards come back as LIMIT_REACHED. A wrong answer that scored nothing *and*
 * left no trace would let a participant work through all three cards.
 */
export function scanPoints(actionPoints: number, option: ScannedOption | null): number {
  return isCorrectScan(option) ? actionPoints : 0
}

/**
 * A trivia task's own code was scanned or typed, rather than one of its answers.
 *
 * The task's code is never printed on a card - only the three answers are - so
 * this is reachable through manual entry, where the task list is on screen.
 * Scoring it would hand out the full points for answering nothing.
 */
export const TRIVIA_ANSWER_REQUIRED_MESSAGE =
  'זו שאלת טריוויה - יש לסרוק את אחד מכרטיסי התשובות שלה.'

/** How a wrong answer reads wherever a scan is listed after the fact. */
export const WRONG_ANSWER_LABEL = 'תשובה שגויה'
export const CORRECT_ANSWER_LABEL = 'תשובה נכונה'
