import { useSyncExternalStore } from 'react'

/**
 * App-wide sound mute, shared by every presentation screen (leaderboard,
 * scanner, lottery). One flag so the toolbar's speaker toggle silences whatever
 * page you're on, and the choice persists across screens and reloads.
 *
 * The key predates this store - the leaderboard already persisted its mute here
 * (see the old useSound), so reusing it carries that preference over.
 */
const STORAGE_KEY = 'leaderboard-sound-muted'

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

let muted = readInitial()
const listeners = new Set<() => void>()

export function isSoundMuted(): boolean {
  return muted
}

export function setSoundMuted(next: boolean): void {
  if (next === muted) return
  muted = next
  try {
    localStorage.setItem(STORAGE_KEY, String(next))
  } catch {
    // Storage blocked - the in-memory flag still drives this session.
  }
  listeners.forEach((fn) => fn())
}

export function toggleSoundMuted(): void {
  setSoundMuted(!muted)
}

/** Run `fn` whenever the mute flag flips; returns an unsubscribe. */
export function subscribeSoundMuted(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Reactive read for components (e.g. the toolbar speaker icon). */
export function useSoundMuted(): boolean {
  return useSyncExternalStore(subscribeSoundMuted, isSoundMuted, isSoundMuted)
}
