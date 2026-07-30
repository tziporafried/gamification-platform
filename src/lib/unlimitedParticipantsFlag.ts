/**
 * The `unlimited_participants` feature flag: this game may hold more than the
 * 70 participants its plan includes.
 *
 * Unlike every other flag in the app, what this one gates is not an area of the
 * UI - it is a cap enforced by check_plan_limit(), the BEFORE INSERT trigger on
 * participants. Migration 088 is what reads it; the client cannot lift a limit
 * the database applies, and must not pretend to.
 *
 * So the hook here exists for wording only: a screen that would otherwise tell
 * an operator they are near a limit that no longer applies to them. Nothing
 * calls it to decide whether an insert may happen - the trigger answers that,
 * and a PLAN_LIMIT_REACHED error is still handled wherever it can arrive.
 *
 * Normally sold per game (a row in event_features), not bundled into a plan,
 * which is why its default_plans is usually left empty in the admin panel.
 */

import { useFeatureFlag } from '@/contexts/EventFeaturesContext'

export const UNLIMITED_PARTICIPANTS_FLAG = 'unlimited_participants'

/** The participant cap has been lifted for this game. False outside a game. */
export function useUnlimitedParticipants(): boolean {
  return useFeatureFlag(UNLIMITED_PARTICIPANTS_FLAG)
}
