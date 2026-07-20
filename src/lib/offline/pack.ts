import { supabase } from '@/lib/supabase'
import type { Action, Group, Participant, Reward } from '@/types'
import { PACK_VERSION, type GamePack } from './types'

/**
 * Gathers everything an event needs to run offline into a single GamePack.
 *
 * Mirrors the reads in EventKioskPage.fetchAll, minus the point_transactions -
 * an exported game starts from a clean slate and accrues its own local scans.
 */
export async function buildEventPack(eventId: string): Promise<GamePack> {
  const [
    eventRes,
    groupsRes,
    participantsRes,
    participantGroupsRes,
    actionsRes,
    actionGroupsRes,
    rewardsRes,
    rewardGroupsRes,
  ] = await Promise.all([
    supabase.from('events').select('id, name, logo_url').eq('id', eventId).single(),
    supabase.from('groups').select('*').eq('event_id', eventId),
    supabase.from('participants').select('*').eq('event_id', eventId),
    supabase
      .from('participant_groups')
      .select('participant_id, group_id, participants!inner(event_id)')
      .eq('participants.event_id', eventId),
    supabase.from('actions').select('*').eq('event_id', eventId).eq('is_active', true),
    supabase
      .from('action_groups')
      .select('action_id, group_id, actions!inner(event_id)')
      .eq('actions.event_id', eventId),
    supabase.from('rewards').select('*').eq('event_id', eventId).eq('is_active', true),
    supabase
      .from('reward_groups')
      .select('reward_id, group_id, rewards!inner(event_id)')
      .eq('rewards.event_id', eventId),
  ])

  const firstError =
    eventRes.error ||
    groupsRes.error ||
    participantsRes.error ||
    participantGroupsRes.error ||
    actionsRes.error ||
    actionGroupsRes.error ||
    rewardsRes.error ||
    rewardGroupsRes.error
  if (firstError) throw firstError
  if (!eventRes.data) throw new Error('האירוע לא נמצא.')

  return {
    version: PACK_VERSION,
    exportedAt: new Date().toISOString(),
    event: {
      id: eventRes.data.id,
      name: eventRes.data.name,
      logo_url: eventRes.data.logo_url,
    },
    groups: (groupsRes.data ?? []) as Group[],
    participants: (participantsRes.data ?? []) as Participant[],
    participantGroups: (participantGroupsRes.data ?? []).map((row) => ({
      participant_id: row.participant_id,
      group_id: row.group_id,
    })),
    actions: (actionsRes.data ?? []) as Action[],
    actionGroups: (actionGroupsRes.data ?? []).map((row) => ({
      action_id: row.action_id,
      group_id: row.group_id,
    })),
    rewards: (rewardsRes.data ?? []) as Reward[],
    rewardGroups: (rewardGroupsRes.data ?? []).map((row) => ({
      reward_id: row.reward_id,
      group_id: row.group_id,
    })),
  }
}
