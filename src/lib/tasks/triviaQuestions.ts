/**
 * Reading and writing a trivia question - the task row and its answers together.
 *
 * A question is one `actions` row (kind = 'trivia') and N `action_options` rows,
 * and almost nothing in the app should have to know that. Everything that
 * creates, edits or loads one goes through here so the two halves cannot drift:
 * a task with no answers is a question nobody can answer, and an answer with no
 * task is a card that resolves to nothing.
 *
 * The composer is the only writer. `ActionList` is the only reader.
 */

import { supabase } from '@/lib/supabase'
import type { Action, ActionOption } from '@/types'
import { TRIVIA_OPTION_COUNT } from './triviaTasksFlag'

/** What the composer holds while it is being filled in. */
export interface TriviaDraft {
  question: string
  points: number
  /** One string per answer card, in the order the operator typed them. */
  answers: string[]
  /** Index into `answers`. -1 while nothing is marked. */
  correctIndex: number
}

export function emptyTriviaDraft(points = 20): TriviaDraft {
  return {
    question: '',
    points,
    answers: Array.from({ length: TRIVIA_OPTION_COUNT }, () => ''),
    correctIndex: -1,
  }
}

/**
 * Turns a saved question back into something the composer can edit.
 *
 * Padded to the full count so the dialog can never render with fewer fields
 * than the question has cards. `updateTriviaQuestion` writes back by position
 * against the rows that exist, so a pad is only ever a blank the operator sees.
 */
export function draftFromQuestion(action: Action, options: ActionOption[]): TriviaDraft {
  const ordered = [...options].sort((a, b) => a.sort_order - b.sort_order)
  const answers = ordered.map((o) => o.label)
  while (answers.length < TRIVIA_OPTION_COUNT) answers.push('')

  return {
    question: action.name,
    points: action.points,
    answers,
    correctIndex: ordered.findIndex((o) => o.is_correct),
  }
}

export type TriviaFieldError = { field: 'question' | 'answers' | 'correct'; message: string }

/**
 * Everything that has to be true before a question can be saved.
 *
 * "Exactly one correct answer" is half enforced by the database - a partial
 * unique index refuses a second one (088) - and half only here: a question with
 * *no* correct answer cannot be caught by a row constraint, because a question
 * legitimately has none until its answers are written.
 */
export function validateTriviaDraft(
  draft: TriviaDraft,
  siblingNames: string[] = [],
): TriviaFieldError | null {
  const question = draft.question.trim()
  if (!question) return { field: 'question', message: 'יש לכתוב את השאלה' }

  if (siblingNames.some((n) => n.trim().toLowerCase() === question.toLowerCase())) {
    return { field: 'question', message: 'כבר קיימת משימה בשם זה' }
  }

  const answers = draft.answers.map((a) => a.trim())
  if (answers.some((a) => !a)) {
    return { field: 'answers', message: `יש למלא את כל ${answers.length} התשובות` }
  }

  const seen = new Set(answers.map((a) => a.toLowerCase()))
  if (seen.size !== answers.length) {
    return { field: 'answers', message: 'שתי תשובות זהות - לא ניתן לבחור ביניהן' }
  }

  if (draft.correctIndex < 0 || draft.correctIndex >= answers.length) {
    return { field: 'correct', message: 'יש לסמן איזו תשובה נכונה' }
  }

  return null
}

/**
 * Insertion order decides the codes (`A-1003-1`, `-2`, `-3`) and the order the
 * cards are laid out, so it is shuffled rather than taken as typed.
 *
 * On a code128 game the code prints as readable text under the barcode. If the
 * answer marked correct were always inserted first, `-1` would be the answer -
 * printed on the card, for anyone who thought to compare two of them.
 */
function shuffled<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface SavedQuestion {
  action: Action
  options: ActionOption[]
}

/**
 * Writes a new question.
 *
 * `max_completions: 1` is not a default the operator chose - it is what makes
 * the question a question. Without it a participant scans all three cards and
 * keeps the points from whichever was right.
 */
export async function createTriviaQuestion(
  eventId: string,
  draft: TriviaDraft,
): Promise<SavedQuestion> {
  const { data: action, error: actionError } = await supabase
    .from('actions')
    .insert({
      event_id: eventId,
      name: draft.question.trim(),
      points: draft.points,
      kind: 'trivia',
      max_completions: 1,
    })
    .select('*')
    .single()

  if (actionError) throw actionError

  const rows = shuffled(
    draft.answers.map((label, i) => ({
      label: label.trim(),
      is_correct: i === draft.correctIndex,
    })),
  ).map((row, sort_order) => ({ ...row, sort_order, action_id: action.id }))

  const { data: options, error: optionsError } = await supabase
    .from('action_options')
    .insert(rows)
    .select('*')

  if (optionsError) {
    // A question with no answers is worse than no question: it prints nothing,
    // scans as nothing, and sits in the list looking finished. Take it back out.
    await supabase.from('actions').delete().eq('id', action.id)
    throw optionsError
  }

  return { action: action as Action, options: (options ?? []) as ActionOption[] }
}

/**
 * Edits a saved question in place.
 *
 * The answer rows keep their ids and therefore their codes, so a deck already
 * printed still scans. (Rewriting an answer's *text* after printing is another
 * matter, and one only the operator can know about.)
 */
export async function updateTriviaQuestion(
  action: Action,
  options: ActionOption[],
  draft: TriviaDraft,
): Promise<SavedQuestion> {
  const { data: updatedAction, error: actionError } = await supabase
    .from('actions')
    .update({ name: draft.question.trim(), points: draft.points })
    .eq('id', action.id)
    .select('*')
    .single()

  if (actionError) throw actionError

  const ordered = [...options].sort((a, b) => a.sort_order - b.sort_order)

  // Clear every correct flag before setting the new one. Both in one pass would
  // briefly leave two rows marked, which the unique index in 088 refuses.
  const { error: clearError } = await supabase
    .from('action_options')
    .update({ is_correct: false })
    .eq('action_id', action.id)

  if (clearError) throw clearError

  for (let i = 0; i < ordered.length; i++) {
    const label = draft.answers[i]?.trim()
    if (label === undefined) continue
    const { error } = await supabase
      .from('action_options')
      .update({ label, is_correct: i === draft.correctIndex })
      .eq('id', ordered[i].id)
    if (error) throw error
  }

  const { data: fresh } = await supabase
    .from('action_options')
    .select('*')
    .eq('action_id', action.id)
    .order('sort_order')

  return { action: updatedAction as Action, options: (fresh ?? []) as ActionOption[] }
}

/**
 * Every answer in the game, grouped by the task it belongs to.
 *
 * One query for the whole list rather than one per task. A database without 088
 * answers with an error, which resolves to an empty map: no task has answers,
 * every task renders as the standard task it is.
 */
export async function fetchEventOptions(eventId: string): Promise<Map<string, ActionOption[]>> {
  const { data, error } = await supabase
    .from('action_options')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order')

  const byAction = new Map<string, ActionOption[]>()
  if (error || !data) return byAction

  for (const row of data as ActionOption[]) {
    const list = byAction.get(row.action_id)
    if (list) list.push(row)
    else byAction.set(row.action_id, [row])
  }
  return byAction
}
