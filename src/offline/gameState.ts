import type { GamePack, GameState } from '@/lib/offline/types'

/**
 * localStorage persistence for a running offline game.
 *
 * Every file:// page on a machine shares one storage origin (verified), so the
 * key MUST be namespaced by event id - otherwise two exported games on the same
 * computer would overwrite each other's scans.
 */

const KEY_PREFIX = 'gamify.offline.state.'

/** localStorage key for an event's saved game, namespaced to avoid collisions. */
export function storageKeyFor(eventId: string): string {
  return KEY_PREFIX + eventId
}

export function emptyGameState(): GameState {
  return { scans: [], awards: [] }
}

/** Restores saved progress for this event, or a clean slate. */
export function loadGameState(pack: GamePack): GameState {
  try {
    const raw = localStorage.getItem(storageKeyFor(pack.event.id))
    if (!raw) return emptyGameState()
    const parsed = JSON.parse(raw) as Partial<GameState>
    return {
      scans: Array.isArray(parsed.scans) ? parsed.scans : [],
      awards: Array.isArray(parsed.awards) ? parsed.awards : [],
    }
  } catch {
    // Corrupt or unreadable storage should never block starting the game.
    return emptyGameState()
  }
}

/** Persists progress. Called after every scan so a crash loses nothing. */
export function saveGameState(pack: GamePack, state: GameState): void {
  try {
    localStorage.setItem(storageKeyFor(pack.event.id), JSON.stringify(state))
  } catch {
    // Out of quota is the only realistic failure; the in-memory game continues.
  }
}

/** Clears saved progress - used by an explicit "reset game" action. */
export function clearGameState(pack: GamePack): void {
  try {
    localStorage.removeItem(storageKeyFor(pack.event.id))
  } catch {
    // ignore
  }
}
