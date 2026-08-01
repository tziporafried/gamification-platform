/**
 * The `trivia_tasks` feature flag: this game may build a task as a question.
 *
 * A trivia task prints three cards instead of one - a card per answer - and only
 * the correct one is worth its points. A wrong answer scans, scores 0, and is
 * recorded, which is what spends the participant's single attempt; without that
 * row they would simply scan all three cards.
 *
 * From the organiser's side it is still one task in the list: one score, one set
 * of groups, one limit, counted once against the plan. The three cards are a
 * detail of what gets printed (migration 088).
 *
 * ── What the flag gates, and what it deliberately does not ───────────────────
 * The flag hides the *making* of a question: the button on the tasks step, the
 * composer, and the answers shown on a task row. A game without it sees no
 * trivia anywhere - not a locked version of it.
 *
 * Scanning is not gated. `useScoreSubmit` resolves an answer code whatever the
 * catalogue says, because a game that printed a deck and then lost the flag must
 * still read the cards its participants are holding. Withdrawing a flag stops
 * new questions being written; it does not turn a printed deck into litter.
 *
 * Like every flag, it is created by hand in the admin panel. Until that row
 * exists this resolves off and none of the above is reachable.
 */

import { useFeatureFlag } from '@/contexts/EventFeaturesContext'

export const TRIVIA_TASKS_FLAG = 'trivia_tasks'

/** Can this game write trivia questions? False outside a game. */
export function useTriviaTasks(): boolean {
  return useFeatureFlag(TRIVIA_TASKS_FLAG)
}

/** How many answers a new question is built with. Fixed, for now. */
export const TRIVIA_OPTION_COUNT = 3

/**
 * `isTriviaAction` and the scoring rules deliberately live in
 * `src/lib/tasks/triviaScan.ts`, not here: the offline player imports them and
 * must not reach the React context this file uses. Import them from there.
 */

/**
 * True when a write failed only because migration 088 has not been applied to
 * this database - there is nowhere to put a question or its answers.
 *
 * Only a game with the flag can reach this. Everywhere else no query names
 * either table, so a database missing 088 behaves exactly as it did before.
 */
export function isMissingTriviaTablesError(message: string | null | undefined): boolean {
  if (!message) return false
  const missing = message.includes('does not exist') || message.includes('schema cache')
  return missing && (message.includes('action_options') || message.includes('kind'))
}

export const MISSING_TRIVIA_TABLES_MESSAGE =
  'שאלות טריוויה עדיין לא מותקנות במסד הנתונים. הריצו את APPLY_TRIVIA_TASKS.sql ונסו שוב.'
