/**
 * Prize-win fanfare for the scanner screen - a real recorded "level up" fanfare
 * (~2.95s), played when the full-screen reward celebration takes over.
 *
 * Kept apart from playScanSuccess(): that beep confirms every scan, this fires
 * only on the rare win, so it is allowed to be long and loud.
 *
 * The `/sounds/...` literal is deliberate - the offline player's build inlines
 * it as a base64 data URI (see inlinePublicAssets in vite.offline.config.ts), so
 * an exported game plays the same fanfare with no network.
 */

import { isSoundMuted } from '@/lib/soundMuted'

export const REWARD_FANFARE_SRC = '/sounds/reward-fanfare.mp3'

/** Loud enough to carry over a room, still short of clipping on kiosk speakers. */
const VOLUME = 0.8

/** One element, reused: a win can fire repeatedly across a long session. */
let audio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (audio) return audio
  try {
    audio = new Audio(REWARD_FANFARE_SRC)
    audio.preload = 'auto'
    audio.volume = VOLUME
  } catch {
    return null
  }
  return audio
}

/**
 * Optional warm-up from inside a user gesture, so the first win plays instantly
 * instead of waiting on the download. Safe to call more than once.
 */
export function primeRewardFanfare(): void {
  try {
    getAudio()?.load()
  } catch {
    /* ignore */
  }
}

/** Play the win fanfare. Call only when a prize celebration actually opens. */
export function playRewardFanfare(): void {
  if (isSoundMuted('scan')) return
  const el = getAudio()
  if (!el) return
  try {
    // Back-to-back wins (a queued celebration) restart the fanfare rather than
    // stacking elements on top of each other.
    el.currentTime = 0
    el.volume = VOLUME
    void el.play().catch(() => { /* autoplay blocked - stay silent */ })
  } catch {
    /* audio unavailable - never break the celebration */
  }
}

/** Cut the fanfare short (e.g. the operator dismissed the celebration). */
export function stopRewardFanfare(): void {
  try {
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
  } catch {
    /* ignore */
  }
}
