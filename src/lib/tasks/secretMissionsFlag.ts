/**
 * The `secret_missions` feature flag: this game may mark a task as one
 * participant's secret mission (migration 094).
 *
 * The flag gates the *making* of one - the checkbox and the participant picker
 * on a task row. The scan screen and the scan itself honour `is_secret` whatever
 * the flag says, for the same reason trivia scanning is not gated: a game that
 * lost the flag mid-event must not suddenly print a secret on the big screen.
 *
 * Like every flag, it is created by hand in the admin panel.
 */

import { useFeatureFlag } from '@/contexts/EventFeaturesContext'

export const SECRET_MISSIONS_FLAG = 'secret_missions'

/** Can this game mark tasks as secret missions? False outside a game. */
export function useSecretMissions(): boolean {
  return useFeatureFlag(SECRET_MISSIONS_FLAG)
}

/**
 * True when a write failed only because migration 094 has not been applied to
 * this database - there is no column to put the checkbox in.
 */
export function isMissingSecretColumnsError(message: string | null | undefined): boolean {
  if (!message) return false
  const missing = message.includes('does not exist') || message.includes('schema cache')
  return missing && (message.includes('is_secret') || message.includes('secret_participant_id'))
}

export const MISSING_SECRET_COLUMNS_MESSAGE =
  'משימות סודיות עדיין לא מותקנות במסד הנתונים. הריצו את APPLY_SECRET_MISSIONS.sql ונסו שוב.'
