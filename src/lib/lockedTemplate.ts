import { supabase } from '@/lib/supabase'
import type { LockedTemplateStore } from '@/types'

const storageKey = (eventId: string) => `gamify:locked-template:${eventId}`
export const LOCKED_TEMPLATE_CHANGED = 'gamify:locked-template-changed'

export function saveLockedTemplate(eventId: string, data: LockedTemplateStore) {
  localStorage.setItem(storageKey(eventId), JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(LOCKED_TEMPLATE_CHANGED, { detail: { eventId } }))
}

export function getLockedTemplate(eventId: string): LockedTemplateStore | null {
  const raw = localStorage.getItem(storageKey(eventId))
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function clearLockedTemplate(eventId: string) {
  localStorage.removeItem(storageKey(eventId))
  window.dispatchEvent(new CustomEvent(LOCKED_TEMPLATE_CHANGED, { detail: { eventId } }))
}

export async function completeTemplateImport(eventId: string): Promise<void> {
  const stored = getLockedTemplate(eventId)
  if (!stored) return

  const [groupsRes, actionsRes, rewardsRes] = await Promise.all([
    supabase.from('groups').select('name').eq('event_id', eventId),
    supabase.from('actions').select('name').eq('event_id', eventId),
    supabase.from('rewards').select('name').eq('event_id', eventId),
  ])

  const existingGroupNames = new Set((groupsRes.data ?? []).map((g) => g.name))
  const existingActionNames = new Set((actionsRes.data ?? []).map((a) => a.name))
  const existingRewardNames = new Set((rewardsRes.data ?? []).map((r) => r.name))

  const toImportGroups = stored.groups.filter((g) => !existingGroupNames.has(g.name))
  const toImportTasks = stored.tasks.filter((t) => !existingActionNames.has(t.name))
  const toImportRewards = stored.rewards.filter((r) => !existingRewardNames.has(r.name))

  const groupNameToId = new Map<string, string>()

  if (toImportGroups.length > 0) {
    const { data: inserted, error } = await supabase
      .from('groups')
      .insert(toImportGroups.map((g) => ({ event_id: eventId, name: g.name, color: g.color })))
      .select('id, name')
    if (error) throw error
    for (const g of inserted ?? []) groupNameToId.set(g.name, g.id)
  }

  // Also need IDs of existing groups for action_groups wiring
  if (toImportTasks.some((t) => t.eligible_group_names.length > 0)) {
    const { data: allGroups } = await supabase.from('groups').select('id, name').eq('event_id', eventId)
    for (const g of allGroups ?? []) {
      if (!groupNameToId.has(g.name)) groupNameToId.set(g.name, g.id)
    }
  }

  const actionNameToId = new Map<string, string>()
  if (toImportTasks.length > 0) {
    const { data: inserted, error } = await supabase
      .from('actions')
      .insert(
        toImportTasks.map((t) => ({
          event_id: eventId,
          name: t.name,
          points: t.points,
          description: t.description ?? null,
          max_completions: t.max_completions ?? null,
        })),
      )
      .select('id, name')
    if (error) throw error
    for (const a of inserted ?? []) actionNameToId.set(a.name, a.id)
  }

  const actionGroupRows: { action_id: string; group_id: string }[] = []
  for (const task of toImportTasks) {
    if (task.eligible_group_names.length === 0) continue
    const actionId = actionNameToId.get(task.name)
    if (!actionId) continue
    for (const groupName of task.eligible_group_names) {
      const groupId = groupNameToId.get(groupName)
      if (groupId) actionGroupRows.push({ action_id: actionId, group_id: groupId })
    }
  }
  if (actionGroupRows.length > 0) {
    const { error } = await supabase.from('action_groups').insert(actionGroupRows)
    if (error) throw error
  }

  if (toImportRewards.length > 0) {
    const { error } = await supabase.from('rewards').upsert(
      toImportRewards.map((r) => ({
        event_id: eventId,
        name: r.name,
        required_points: r.required_points,
      })),
      { onConflict: 'event_id,name', ignoreDuplicates: true },
    )
    if (error) throw error
  }

  clearLockedTemplate(eventId)
}
