import type { EligibleParticipant } from '../types'

/**
 * The scan lottery's collection, in the browser.
 *
 * The organizer opens a collection, scans people in on the lottery screen,
 * closes it, and draws. All of that lives in localStorage, next to the two
 * things the lottery already kept there - the winners (lotteryWinners) and the
 * launched run (lotterySession).
 *
 * This started out as two database tables. They were built on the assumption
 * that every scanning station in the game fed the pool, which made a shared,
 * server-side collection unavoidable. Once scanning moved to the lottery
 * screen alone, that whole justification went with it: one screen writes, one
 * screen reads, and everything the tables bought - a primary key to stop a
 * second writer, row-level security, a realtime feed - was protecting against
 * something that no longer happens.
 *
 * What is genuinely given up: the collection lives in one browser profile. A
 * different machine, a cleared cache or a private window starts empty, and a
 * lost collection cannot be recovered from the server. That is the same bet
 * the winners list already makes, on a list that matters more, and a
 * collection lasts minutes rather than days.
 *
 * Everything here is synchronous. That is most of the simplification: no
 * loading states, no in-flight guards, no races, no error branches for
 * connections that are not made.
 */

/** One person, in the hat once. */
interface StoredEntry {
  participantId: string
  name: string
}

interface StoredCollection {
  id: string
  openedAt: number
  /** null while still collecting. */
  closedAt: number | null
  entries: StoredEntry[]
}

export type ScanLotteryStatus = 'idle' | 'open' | 'closed'

export interface ScanLotteryCollection {
  id: string
  openedAt: number
  closedAt: number | null
  participants: EligibleParticipant[]
}

const storageKey = (eventId: string) => `lottery-scan:${eventId}`

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function read(eventId: string): StoredCollection | null {
  try {
    const raw = localStorage.getItem(storageKey(eventId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredCollection
    if (!parsed?.id || !Array.isArray(parsed.entries)) return null
    return parsed
  } catch {
    // Unreadable or unavailable storage reads as "nothing collected yet",
    // which is exactly what the dock should offer to start.
    return null
  }
}

function write(eventId: string, collection: StoredCollection | null): void {
  try {
    if (collection) localStorage.setItem(storageKey(eventId), JSON.stringify(collection))
    else localStorage.removeItem(storageKey(eventId))
  } catch {
    // Private windows and full quotas throw. The collection then lives only
    // for as long as this screen does, which still runs the lottery in front
    // of the room - better than refusing the scan in the organizer's hand.
  }
}

function toPublic(stored: StoredCollection): ScanLotteryCollection {
  return {
    id: stored.id,
    openedAt: stored.openedAt,
    closedAt: stored.closedAt,
    participants: stored.entries.map((e) => ({
      id: e.participantId,
      name: e.name,
      // Points are ignored by this lottery, and one ticket each is the rule -
      // enforced by addScanLotteryEntry rather than counted here.
      points: 0,
      entries: 1,
    })),
  }
}

export function statusOf(collection: ScanLotteryCollection | null): ScanLotteryStatus {
  if (!collection) return 'idle'
  return collection.closedAt == null ? 'open' : 'closed'
}

/**
 * What this game has collected, if anything.
 *
 * A *closed* collection is not returned: setting up a lottery starts from
 * nothing rather than from the last one's finished pool. One closed during
 * this session stays on screen because the hook still holds it in state.
 *
 * An *empty open* one is swept away for the same reason it was under the
 * tables - only this screen can add to it, so a collection left open by an
 * earlier visit was never collecting, and offering to resume it was the whole
 * reason the button kept saying "המשיכו לאסוף".
 */
export function loadScanLottery(eventId: string): ScanLotteryCollection | null {
  const stored = read(eventId)
  if (!stored) return null
  if (stored.closedAt != null) return null
  if (stored.entries.length === 0) {
    write(eventId, null)
    return null
  }
  return toPublic(stored)
}

/** Starts collecting, discarding whatever came before. */
export function openScanLottery(eventId: string): ScanLotteryCollection {
  const fresh: StoredCollection = {
    id: createId(),
    openedAt: Date.now(),
    closedAt: null,
    entries: [],
  }
  write(eventId, fresh)
  return toPublic(fresh)
}

/** Closes it. Scans after this are not entries. */
export function closeScanLottery(eventId: string): ScanLotteryCollection | null {
  const stored = read(eventId)
  if (!stored) return null
  // Closing twice must not move the cutoff on a pool already drawn from.
  const closed: StoredCollection = { ...stored, closedAt: stored.closedAt ?? Date.now() }
  write(eventId, closed)
  return toPublic(closed)
}

/** Throws the collection away entirely - "הגרלה חדשה". */
export function clearScanLottery(eventId: string): void {
  write(eventId, null)
}

/**
 * Puts one person in the hat.
 *
 * Returns false when they were already in it, which is the cap: one ticket per
 * participant, however many times they scan. The stage says that out loud
 * rather than silently doing nothing.
 *
 * A scan into a closed (or missing) collection is refused, so closing the
 * lottery means closed even if a card is read a moment later.
 */
export function addScanLotteryEntry(
  eventId: string,
  participant: { id: string; name: string },
): { added: boolean } {
  const stored = read(eventId)
  if (!stored || stored.closedAt != null) return { added: false }
  if (stored.entries.some((e) => e.participantId === participant.id)) return { added: false }

  write(eventId, {
    ...stored,
    entries: [...stored.entries, { participantId: participant.id, name: participant.name }],
  })
  return { added: true }
}
