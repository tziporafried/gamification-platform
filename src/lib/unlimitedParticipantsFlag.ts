/**
 * The `unlimited_participants` feature flag: this game may hold more than the
 * 70 participants its plan includes.
 *
 * Unlike every other flag in the app, what this one gates is not an area of the
 * UI - it is a cap enforced by check_plan_limit(), the BEFORE INSERT trigger on
 * participants. Migrations 088/089 are what read it; the client cannot lift a
 * limit the database applies, and must not pretend to.
 *
 * Since 089 the flag is the *only* thing that decides the cap for a paid plan.
 * There is no plan list in the trigger any more: organizations is uncapped
 * because the flag's default_plans says so in the admin panel, and moving a
 * product in or out of that list is what changes who has a cap. Trial (`free`)
 * has had no entity cap since 054 and is outside this entirely.
 *
 * So the hook here exists for wording only: a screen that would otherwise tell
 * an operator they are near a limit that no longer applies to them. Nothing
 * calls it to decide whether an insert may happen - the trigger answers that,
 * and a PLAN_LIMIT_REACHED error is still handled wherever it can arrive.
 */

import { useFeatureFlag } from '@/contexts/EventFeaturesContext'

export const UNLIMITED_PARTICIPANTS_FLAG = 'unlimited_participants'

/** The participant cap has been lifted for this game. False outside a game. */
export function useUnlimitedParticipants(): boolean {
  return useFeatureFlag(UNLIMITED_PARTICIPANTS_FLAG)
}
