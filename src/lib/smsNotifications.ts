/**
 * The `sms_notifications` feature flag: this game texts its participants, so
 * every participant needs a phone number.
 *
 * The flag turns on both halves of that sentence.
 *
 * Collecting the number: one field in three places - the inline add field on
 * the participants step, the row editor beside it, and a טלפון column in the
 * roster import - all of them normalising through src/lib/phone.ts. A game
 * without the flag never sees any of it, and the column simply stays empty.
 *
 * Using it: every scan texts the participant what they just scored, on which
 * task, and their new total. That lives in src/lib/scanSms.ts and is fired from
 * useScoreSubmit, so every scanning station in the app gets it at once.
 *
 * The flag is created by hand in the admin panel, like every other one (see
 * src/lib/eventFeatures.ts). Until the key below exists there, every game reads
 * it as off and none of this appears - which is also what makes shipping this
 * code before creating the flag a non-event.
 *
 * Migration 081 is the other half: the column the flag fills. It creates no
 * flag, and the two can be applied in either order.
 */

import { useFeatureFlag } from '@/contexts/EventFeaturesContext'

export const SMS_NOTIFICATIONS_FLAG = 'sms_notifications'

/** Does the current game collect phone numbers? False outside a game. */
export function useSmsNotifications(): boolean {
  return useFeatureFlag(SMS_NOTIFICATIONS_FLAG)
}

/**
 * True when a write failed only because migration 081 has not been applied to
 * this database. Worth telling apart: the operator sold SMS, turned the flag
 * on, and the field they were just shown refuses every number - which reads as
 * a broken feature rather than as one missing migration.
 */
export function isMissingPhoneColumnError(message: string | null | undefined): boolean {
  if (!message) return false
  const missing = message.includes('does not exist') || message.includes('schema cache')
  return missing && message.includes('phone')
}

export const MISSING_PHONE_COLUMN_MESSAGE =
  'שמירת מספרי טלפון עדיין לא מותקנת במסד הנתונים. הריצו את APPLY_PARTICIPANT_PHONE.sql ונסו שוב.'

/** The same story one migration later: 082, the message the game sends. */
export function isMissingSmsTemplateColumnError(message: string | null | undefined): boolean {
  if (!message) return false
  const missing = message.includes('does not exist') || message.includes('schema cache')
  return missing && message.includes('sms_template')
}

export const MISSING_SMS_TEMPLATE_COLUMN_MESSAGE =
  'שמירת נוסח ההודעה עדיין לא מותקנת במסד הנתונים. הריצו את APPLY_EVENT_SMS_TEMPLATE.sql ונסו שוב.'
