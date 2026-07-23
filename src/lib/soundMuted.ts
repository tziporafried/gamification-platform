import { useSyncExternalStore } from 'react'

/**
 * Per-screen sound mute. Each fullscreen presentation screen keeps its own
 * independent on/off, so muting the scanner does not silence the lottery or the
 * leaderboard.
 *
 * Deliberately in-memory only: it is NOT persisted, so every page load / refresh
 * resets sound back ON (unmuted) for every screen. The toggle only lives for the
 * current session.
 */
export type SoundScope = 'scan' | 'lottery' | 'leaderboard'

const state: Record<SoundScope, boolean> = {
  scan: false,
  lottery: false,
  leaderboard: false,
}
const listeners = new Set<() => void>()

export function isSoundMuted(scope: SoundScope): boolean {
  return state[scope]
}

export function setSoundMuted(scope: SoundScope, next: boolean): void {
  if (next === state[scope]) return
  state[scope] = next
  listeners.forEach((fn) => fn())
}

export function toggleSoundMuted(scope: SoundScope): void {
  setSoundMuted(scope, !state[scope])
}

/** Run `fn` whenever any scope's mute flips; returns an unsubscribe. */
export function subscribeSoundMuted(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Reactive read for components (e.g. the toolbar speaker icon). */
export function useSoundMuted(scope: SoundScope): boolean {
  return useSyncExternalStore(
    subscribeSoundMuted,
    () => state[scope],
    () => state[scope],
  )
}
