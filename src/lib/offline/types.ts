import type { Action, Group, Participant, Reward } from '@/types'

/**
 * Everything an exported game needs to run with no network.
 *
 * This is embedded verbatim into the downloaded HTML file, so it must stay
 * JSON-serializable and self-contained — no ids pointing at rows that aren't here.
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
  rewards: Reward[]
  rewardGroups: { reward_id: string; group_id: string }[]
}

/** A scan recorded on the disconnected machine. */
export interface LocalScan {
  /** Client-generated; the queue's identity and its de-dupe key. */
  clientTxId: string
  participantId: string
  actionId: string
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

export const PACK_VERSION = 1
