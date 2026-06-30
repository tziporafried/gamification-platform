import { supabase } from '@/lib/supabase'
import { FREE_PLAN_LIMITS } from '@/lib/plans'
import type { ActivityTemplateWithContent, GroupType, TemplateImportResult, TemplateTask } from '@/types'

export async function fetchActivityTemplates(): Promise<ActivityTemplateWithContent[]> {
  const [
    { data: templates },
    { data: templateGroups },
    { data: taskLinks },
    { data: tasks },
    { data: taskGroupLinks },
    { data: rewards },
  ] = await Promise.all([
    supabase.from('activity_templates').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('activity_template_groups').select('*').order('sort_order'),
    supabase.from('activity_template_tasks').select('*').order('sort_order'),
    supabase.from('template_tasks').select('*').order('sort_order'),
    supabase.from('template_task_groups').select('*'),
    supabase.from('template_rewards').select('*').order('sort_order'),
  ])

  if (!templates) return []

  const tasksById = new Map((tasks ?? []).map((t) => [t.id, t]))

  const eligibleGroupsByTaskId = new Map<string, string[]>()
  for (const link of taskGroupLinks ?? []) {
    const names = eligibleGroupsByTaskId.get(link.template_task_id) ?? []
    names.push(link.group_name)
    eligibleGroupsByTaskId.set(link.template_task_id, names)
  }

  return templates.map((tmpl) => ({
    ...tmpl,
    groups: (templateGroups ?? []).filter((g) => g.activity_template_id === tmpl.id),
    tasks: [
      ...new Map(
        (taskLinks ?? [])
          .filter((link) => link.activity_template_id === tmpl.id)
          .flatMap((link) => {
            const task = tasksById.get(link.template_task_id)
            if (!task) return []
            return [{ ...task, eligible_group_names: eligibleGroupsByTaskId.get(task.id) ?? [] } as TemplateTask]
          })
          .map((t) => [t.id, t]),
      ).values(),
    ],
    rewards: (rewards ?? []).filter((r) => r.activity_template_id === tmpl.id),
  }))
}

export async function applyActivityTemplate(
  eventId: string,
  template: ActivityTemplateWithContent,
  isFreePlan: boolean,
): Promise<TemplateImportResult> {
  // Slice to plan limits for free users — prevents DB PLAN_LIMIT_REACHED errors
  const groupLimit  = isFreePlan ? FREE_PLAN_LIMITS.groups  : template.groups.length
  const taskLimit   = isFreePlan ? FREE_PLAN_LIMITS.actions : template.tasks.length
  const rewardLimit = isFreePlan ? FREE_PLAN_LIMITS.rewards : template.rewards.length

  const importedGroups  = template.groups.slice(0, groupLimit)
  const importedTasks   = template.tasks.slice(0, taskLimit)
  const importedRewards = template.rewards.slice(0, rewardLimit)
  const lockedGroups    = template.groups.slice(groupLimit)
  const lockedTasks     = template.tasks.slice(taskLimit)
  const lockedRewards   = template.rewards.slice(rewardLimit)

  // Pre-fetch existing names to make the import idempotent (safe to re-run)
  const [existingGroupsRes, existingActionsRes, existingRewardsRes] = await Promise.all([
    template.group_type === 'custom'
      ? supabase.from('groups').select('id, name').eq('event_id', eventId)
      : Promise.resolve({ data: [] }),
    supabase.from('actions').select('id, name').eq('event_id', eventId),
    supabase.from('rewards').select('name').eq('event_id', eventId),
  ])
  const existingActionNames = new Set((existingActionsRes.data ?? []).map((a) => a.name))
  const existingRewardNames = new Set((existingRewardsRes.data ?? []).map((r) => r.name))

  // Deduplicate within the template batch itself (guards against bad template data)
  const uniqueGroups  = [...new Map(importedGroups.map((g) => [g.name, g])).values()]
  const uniqueTasks   = [...new Map(importedTasks.map((t) => [t.name, t])).values()]
  const uniqueRewards = [...new Map(importedRewards.map((r) => [r.name, r])).values()]

  // Step 1: Insert new groups and build a name→id map (existing groups also mapped)
  const groupNameToId = new Map<string, string>()
  if (template.group_type === 'custom') {
    for (const g of (existingGroupsRes.data ?? []) as { id: string; name: string }[]) {
      groupNameToId.set(g.name, g.id)
    }
    const toInsert = uniqueGroups.filter((g) => !groupNameToId.has(g.name))
    if (toInsert.length > 0) {
      const { data: insertedGroups, error } = await supabase
        .from('groups')
        .insert(toInsert.map((g) => ({ event_id: eventId, name: g.name, color: g.color })))
        .select('id, name')
      if (error) throw error
      for (const g of insertedGroups ?? []) groupNameToId.set(g.name, g.id)
    }
  }

  // Step 2: Insert only actions that don't already exist
  // (actions has no unique constraint, so pre-fetch filtering is the only guard)
  const actionNameToId = new Map<string, string>()
  for (const a of (existingActionsRes.data ?? []) as { id: string; name: string }[]) {
    actionNameToId.set(a.name, a.id)
  }
  const tasksToInsert = uniqueTasks.filter((t) => !existingActionNames.has(t.name))
  if (tasksToInsert.length > 0) {
    const { data: insertedActions, error } = await supabase
      .from('actions')
      .insert(
        tasksToInsert.map((t) => ({
          event_id: eventId,
          name: t.name,
          points: t.points,
          description: t.description ?? null,
          max_completions: t.max_completions ?? null,
        })),
      )
      .select('id, name')
    if (error) throw error
    for (const a of insertedActions ?? []) actionNameToId.set(a.name, a.id)
  }

  // Step 3: Wire action_groups for tasks with group restrictions.
  // Locked groups have no IDs, so references to them are silently dropped here.
  const actionGroupRows: { action_id: string; group_id: string }[] = []
  for (const task of tasksToInsert) {
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

  // Step 4: Upsert rewards — idx_rewards_event_name constraint exists so ignoreDuplicates is safe
  const rewardsToInsert = uniqueRewards.filter((r) => !existingRewardNames.has(r.name))
  if (rewardsToInsert.length > 0) {
    const { error } = await supabase.from('rewards').upsert(
      rewardsToInsert.map((r) => ({
        event_id: eventId,
        name: r.name,
        required_points: r.required_points,
      })),
      { onConflict: 'event_id,name', ignoreDuplicates: true },
    )
    if (error) throw error
  }

  return {
    templateName: template.name,
    groupType: template.group_type as GroupType,
    imported: {
      groups: importedGroups.length,
      tasks: importedTasks.length,
      rewards: importedRewards.length,
    },
    total: {
      groups: template.groups.length,
      tasks: template.tasks.length,
      rewards: template.rewards.length,
    },
    importedNames: {
      groups: importedGroups.map((g) => g.name),
      tasks: importedTasks.map((t) => t.name),
      rewards: importedRewards.map((r) => r.name),
    },
    lockedNames: {
      groups: lockedGroups.map((g) => g.name),
      tasks: lockedTasks.map((t) => t.name),
      rewards: lockedRewards.map((r) => r.name),
    },
    isPartial: lockedGroups.length > 0 || lockedTasks.length > 0 || lockedRewards.length > 0,
  }
}

export function templateGroupType(template: ActivityTemplateWithContent): GroupType {
  return template.group_type as GroupType
}
