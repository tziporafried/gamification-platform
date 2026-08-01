import { supabase } from '@/lib/supabase'
import type { Action, ActionOption, Group, Participant, Reward } from '@/types'
import { PACK_VERSION, type GamePack } from './types'

/**
 * Turns the event's logo URL into a self-contained data URI so it renders from
 * file:// with no network. The rest of the player is inlined at build time, but
 * the logo is per-event runtime data (a Supabase Storage URL), so it must be
 * inlined here, at export time, while we're still online.
 *
 * Best-effort: an already-inlined logo is returned untouched, and any fetch/read
 * failure falls back to the original URL so the export never breaks (that logo
 * just degrades to how it behaved before - broken only on a disconnected machine).
 */
async function inlineLogo(url: string | null): Promise<string | null> {
  if (!url || url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

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
    actionOptionsRes,
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
    // Deliberately outside the error check below: a database that has not run
    // 088 answers this with "relation does not exist", and that must not stop a
    // game with no trivia in it from being exported at all.
    supabase.from('action_options').select('*').eq('event_id', eventId),
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

  // Inline the logo now (online) so the offline file needs no network for it.
  const logoDataUri = await inlineLogo(eventRes.data.logo_url)

  return {
    version: PACK_VERSION,
    exportedAt: new Date().toISOString(),
    event: {
      id: eventRes.data.id,
      name: eventRes.data.name,
      logo_url: logoDataUri,
    },
    groups: (groupsRes.data ?? []) as Group[],
    // Phone numbers stay out of the export. The offline player scans codes and
    // shows names - it has no use for a number, and the pack is a file that
    // gets copied onto a laptop and mailed around. A game that never collected
    // one would carry an empty `phone` key for no reason either.
    participants: ((participantsRes.data ?? []) as Participant[]).map(
      ({ phone: _phone, ...participant }) => participant,
    ),
    participantGroups: (participantGroupsRes.data ?? []).map((row) => ({
      participant_id: row.participant_id,
      group_id: row.group_id,
    })),
    actions: (actionsRes.data ?? []) as Action[],
    actionGroups: (actionGroupsRes.data ?? []).map((row) => ({
      action_id: row.action_id,
      group_id: row.group_id,
    })),
    // Only when the game actually has answers - an empty array in every pack
    // would be a key that means nothing.
    ...(actionOptionsRes.data && actionOptionsRes.data.length > 0
      ? { actionOptions: actionOptionsRes.data as ActionOption[] }
      : {}),
    rewards: (rewardsRes.data ?? []) as Reward[],
    rewardGroups: (rewardGroupsRes.data ?? []).map((row) => ({
      reward_id: row.reward_id,
      group_id: row.group_id,
    })),
  }
}
