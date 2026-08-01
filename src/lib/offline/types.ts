import type { Action, ActionOption, Group, Participant, Reward } from '@/types'

/**
 * Everything an exported game needs to run with no network.
 *
 * This is embedded verbatim into the downloaded HTML file, so it must stay
 * JSON-serializable and self-contained - no ids pointing at rows that aren't here.
 */
export interface GamePack {
  /** Bumped when the shape changes, so a player can reject a pack it can't read. */
  version: number
  exportedAt: string
  event: {
    id: string
    name: string
    logo_url: string | null
  }
  groups: Group[]
  participants: Participant[]
  participantGroups: { participant_id: string; group_id: string }[]
  actions: Action[]
  /** Empty for an action = available to every group. */
  actionGroups: { action_id: string; group_id: string }[]
  /**
   * The answer cards of the game's trivia tasks (088), if it has any.
   *
   * Optional, and absent in every pack exported before this existed. A pack
   * without it has no trivia in it either, so the scan resolves exactly as it
   * always did - which is why the version bump below is about the *player*
   * being too old, not this field.
   */
  actionOptions?: ActionOption[]
  rewards: Reward[]
  rewardGroups: { reward_id: string; group_id: string }[]
}

/** A scan recorded on the disconnected machine. */
export interface LocalScan {
  /** Client-generated; the queue's identity and its de-dupe key. */
  clientTxId: string
  participantId: string
  actionId: string
  /** The answer scanned, for a trivia task. Null for every standard one. */
  actionOptionId?: string | null
  points: number
  /** ISO timestamp from the local clock. */
  createdAt: string
}

/** A reward handed out locally, mirroring a participant_rewards row. */
export interface LocalAward {
  participantId: string
  rewardId: string
  scoreAtAward: number
  awardedAt: string
}

/** The whole mutable state of a running offline game. */
export interface GameState {
  scans: LocalScan[]
  awards: LocalAward[]
}

/**
 * Not bumped for trivia (088), on purpose.
 *
 * The player template is bundled with the app and the pack is injected into it
 * at export time (exportGame.ts), so the two always come from the same build -
 * an old player can never be handed a new pack. `actionOptions` is optional on
 * top of that: a pack without it has no trivia in it either, and every earlier
 * pack scans exactly as it always did.
 */
export const PACK_VERSION = 1
