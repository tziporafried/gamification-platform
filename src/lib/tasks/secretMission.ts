/**
 * Secret missions (094), without React - the scan path and the offline player
 * import these, and must not reach the context the flag hook uses.
 */

import type { Action } from '@/types'

/** Missing (a database without 094) means not secret. */
export function isSecretAction(action: Pick<Action, 'is_secret'>): boolean {
  return action.is_secret === true
}

/** What the scan screen shows in place of a secret mission's name. */
export function secretMissionTitle(ownerName: string | null | undefined): string {
  return ownerName ? `המשימה הסודית של ${ownerName}` : 'משימה סודית'
}

export const SECRET_MISSION_NOT_YOURS_MESSAGE = 'זו משימה סודית של משתתף/ת אחר/ת.'
