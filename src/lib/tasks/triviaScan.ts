/**
 * What a scanned trivia answer is worth, and what a scan that is not one means.
 *
 * The rules live here rather than in the hook because there are two scoring
 * engines that have to agree to the letter: `useScoreSubmit` (online) and
 * `src/lib/offline/scoreEngine.ts` (the exported game, no network). Both resolve
 * a code the same way and then ask this file the same two questions.
 *
 * The resolution itself cannot be shared - one of them queries Postgres and the
 * other walks arrays in a downloaded file - but it is the same two steps in both:
 *
 *   1. a task whose `code` matches   -> a standard scan, as it has always been
 *   2. otherwise an answer whose `code` matches -> the task it belongs to
 *
 * Step 2 only runs when step 1 found nothing, so a game with no trivia in it
 * pays nothing for this.
 */

/**
 * Nothing in this file may import from `triviaTasksFlag.ts`: that module reaches
 * a React context, and half of what is here runs inside the exported offline
 * game, which has no React and no network. Pure functions only.
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
