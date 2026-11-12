/**
 * The `flash_challenge` feature flag: this game may launch an "אתגר בזק".
 *
 * The flag gates the *launch* - the card in the live-events launcher. With it
 * off, the card stays exactly as it has always been: "בקרוב". The screen at
 * /events/:id/flash is not gated, for the same reason trivia scanning is not:
 * a challenge already running must not vanish from the projector because a flag
 * was withdrawn mid-game.
 *
 * Like every flag, it is created by hand in the admin panel - never seeded in a
 * migration. Until that row exists this resolves off.
 */

import { useFeatureFlag } from '@/contexts/EventFeaturesContext'

export const FLASH_CHALLENGE_FLAG = 'flash_challenge'

/** Can this game launch a flash challenge? False outside a game. */
export function useFlashChallengeEnabled(): boolean {
  return useFeatureFlag(FLASH_CHALLENGE_FLAG)
}
