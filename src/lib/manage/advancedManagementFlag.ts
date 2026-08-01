/**
 * The `advanced_management` feature flag: this game gets the full management
 * screen, on a page of its own.
 *
 * The management popup answers one question at a time while an event runs -
 * who scanned, who won. What it has never had is the participant's own row:
 * name, group, phone, points, scans, prizes, all in one place, and a way to get
 * that out of the app as a file. That is what the flag buys.
 *
 * A game without it keeps the popup exactly as it was and never sees a link to
 * anything more - not a locked one. The route itself redirects back to the
 * control center, so a pasted URL lands somewhere sensible rather than on an
 * error, and the flag stays the only thing that decides.
 *
 * The flag is created in the admin panel, like every other one. Until that row
 * exists, everything below is off and nothing here needs to know.
 */

import { useFeatureFlag } from '@/contexts/EventFeaturesContext'

export const ADVANCED_MANAGEMENT_FLAG = 'advanced_management'

/** Does this game have the full management screen? False outside a game. */
export function useAdvancedManagement(): boolean {
  return useFeatureFlag(ADVANCED_MANAGEMENT_FLAG)
}

/** The screen's own address, and where its tabs live. */
export function advancedManagePath(eventId: string, tab?: string): string {
  return tab ? `/events/${eventId}/manage/${tab}` : `/events/${eventId}/manage`
}
