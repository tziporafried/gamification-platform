import { supabase } from '@/lib/supabase'
import { setWizardPrefs } from '@/lib/wizard'
import type {
  ActivityTemplate,
  ActivityTemplateWithContent,
  EventCounts,
  GroupType,
  TemplateReward,
  TemplateTask,
} from '@/types'

interface ActionGroupJoin {
  group_id: string
  groups: { name: string }
}

function dedupeByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.name)) return false
    seen.add(item.name)
    return true
  })
}

export function isDraftBehindTemplate(
  template: ActivityTemplateWithContent,
  counts: Pick<EventCounts, 'groups' | 'tasks' | 'rewards'>,
): boolean {
  const hasTemplateContent =
    template.groups.length > 0 || template.tasks.length > 0 || template.rewards.length > 0
  const draftEmpty = counts.groups === 0 && counts.tasks === 0 && counts.rewards === 0

  if (draftEmpty && hasTemplateContent) return true
  if (template.group_type === 'custom' && template.groups.length > 0 && counts.groups < template.groups.length) {
    return true
  }
  if (template.tasks.length > 0 && counts.tasks < template.tasks.length) return true
  if (template.rewards.length > 0 && counts.rewards < template.rewards.length) return true
  return false
}

async function getDraftEventCounts(eventId: string): Promise<Pick<EventCounts, 'groups' | 'tasks' | 'rewards'>> {
  const [{ count: groups }, { count: tasks }, { count: rewards }] = await Promise.all([
    supabase.from('groups').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('actions').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('rewards').select('*', { count: 'exact', head: true }).eq('event_id', eventId),
  ])

  return {
    groups: groups ?? 0,
    tasks: tasks ?? 0,
    rewards: rewards ?? 0,
  }
}

let syncChain: Promise<void> = Promise.resolve()

async function loadTemplatesWithContent(
  templates: ActivityTemplate[],
): Promise<ActivityTemplateWithContent[]> {
  if (templates.length === 0) return []

  const templateIds = templates.map((t) => t.id)

  const [
    { data: templateGroups },
    { data: taskLinks },
    { data: tasks },
    { data: taskGroupLinks },
    { data: rewards },
  ] = await Promise.all([
    supabase.from('activity_template_groups').select('*').in('activity_template_id', templateIds).order('sort_order'),
    supabase.from('activity_template_tasks').select('*').in('activity_template_id', templateIds).order('sort_order'),
    supabase.from('template_tasks').select('*').order('sort_order'),
    supabase.from('template_task_groups').select('*'),
    supabase.from('template_rewards').select('*').in('activity_template_id', templateIds).order('sort_order'),
  ])

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
    tasks: (taskLinks ?? [])
      .filter((link) => link.activity_template_id === tmpl.id)
      .flatMap((link) => {
        const task = tasksById.get(link.template_task_id)
        if (!task) return []
        return [{ ...task, eligible_group_names: eligibleGroupsByTaskId.get(task.id) ?? [] } as TemplateTask]
      }),
    rewards: dedupeByName<TemplateReward>(
      (rewards ?? []).filter((r) => r.activity_template_id === tmpl.id),
    ),
  }))
}

export async function fetchActivityTemplates(): Promise<ActivityTemplateWithContent[]> {
  const { data: templates } = await supabase
    .from('activity_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  return loadTemplatesWithContent((templates ?? []) as ActivityTemplate[])
}

export async function fetchAllActivityTemplates(): Promise<ActivityTemplateWithContent[]> {
  const { data: templates } = await supabase
    .from('activity_templates')
    .select('*')
    .order('sort_order')

  return loadTemplatesWithContent((templates ?? []) as ActivityTemplate[])
}

export async function getTemplateByDraftEventId(eventId: string): Promise<ActivityTemplate | null> {
  const { data } = await supabase
    .from('activity_templates')
    .select('*')
    .eq('draft_event_id', eventId)
    .maybeSingle()

  return (data as ActivityTemplate | null) ?? null
}

export async function fetchActivityTemplateById(templateId: string): Promise<ActivityTemplateWithContent | null> {
  const { data: template } = await supabase
    .from('activity_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle()

  if (!template) return null

  const [loaded] = await loadTemplatesWithContent([template as ActivityTemplate])
  return loaded ?? null
}

export async function createActivityTemplate(ownerId: string): Promise<ActivityTemplate> {
  const { data: maxSort } = await supabase
    .from('activity_templates')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const slug = `template-draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      owner_admin_id: ownerId,
      name: 'תבנית חדשה',
      slug,
      status: 'editing',
    })
    .select()
    .single()

  if (eventError || !event) throw eventError ?? new Error('Failed to create draft event')

  const { data: template, error: templateError } = await supabase
    .from('activity_templates')
    .insert({
      name: 'תבנית חדשה',
      description: null,
      group_type: 'none',
      sort_order: (maxSort?.sort_order ?? 0) + 1,
      is_active: false,
      draft_event_id: event.id,
    })
    .select()
    .single()

  if (templateError || !template) throw templateError ?? new Error('Failed to create template')

  setWizardPrefs(event.id, { groupType: 'none', lastStep: 1 })

  return template as ActivityTemplate
}

export async function ensureTemplateDraftEvent(templateId: string, ownerId: string): Promise<string> {
  const template = await fetchActivityTemplateById(templateId)
  if (!template) throw new Error('Template not found')

  let eventId = template.draft_event_id

  if (eventId) {
    const { data: existingEvent } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .neq('status', 'archived')
      .maybeSingle()

    if (!existingEvent) eventId = null
  }

  if (!eventId) {
    const slug = `template-draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        owner_admin_id: ownerId,
        name: template.name,
        slug,
        status: 'editing',
      })
      .select()
      .single()

    if (eventError || !event) throw eventError ?? new Error('Failed to create draft event')
    eventId = event.id
  }

  if (!eventId) throw new Error('Failed to resolve draft event id')

  const counts = await getDraftEventCounts(eventId)
  if (isDraftBehindTemplate(template, counts)) {
    await seedTemplateDraftEvent(templateId, eventId, template)
  } else {
    const { error: linkError } = await supabase
      .from('activity_templates')
      .update({ draft_event_id: eventId })
      .eq('id', templateId)
    if (linkError) throw linkError
  }

  await supabase.from('events').update({ name: template.name }).eq('id', eventId)

  setWizardPrefs(eventId, { groupType: template.group_type as GroupType, lastStep: 1 })

  return eventId
}

export async function updateTemplateMetadata(
  templateId: string,
  eventId: string,
  name: string,
  description: string | null,
): Promise<void> {
  const trimmedName = name.trim()
  const { error: templateError } = await supabase
    .from('activity_templates')
    .update({ name: trimmedName, description: description?.trim() || null })
    .eq('id', templateId)

  if (templateError) throw templateError

  const { error: eventError } = await supabase
    .from('events')
    .update({ name: trimmedName })
    .eq('id', eventId)

  if (eventError) throw eventError
}

export async function syncEventToTemplate(
  eventId: string,
  templateId: string,
  groupType: GroupType,
): Promise<void> {
  const run = () => syncEventToTemplateInner(eventId, templateId, groupType)
  syncChain = syncChain.then(run, run)
  return syncChain
}

async function syncEventToTemplateInner(
  eventId: string,
  templateId: string,
  groupType: GroupType,
): Promise<void> {
  const [
    { data: event },
    { data: groups },
    { data: actionsRes },
    { data: rewards },
    { data: templateMeta },
  ] = await Promise.all([
    supabase.from('events').select('name').eq('id', eventId).single(),
    supabase.from('groups').select('*').eq('event_id', eventId).order('created_at'),
    supabase
      .from('actions')
      .select('*, action_groups(group_id, groups(name))')
      .eq('event_id', eventId)
      .order('created_at'),
    supabase.from('rewards').select('*').eq('event_id', eventId).order('created_at'),
    supabase.from('activity_templates').select('description').eq('id', templateId).single(),
  ])

  if (!event) throw new Error('Draft event not found')

  const { error: metaError } = await supabase
    .from('activity_templates')
    .update({
      name: event.name,
      description: templateMeta?.description ?? null,
      group_type: groupType,
    })
    .eq('id', templateId)

  if (metaError) throw metaError

  const { data: existingLinks } = await supabase
    .from('activity_template_tasks')
    .select('template_task_id')
    .eq('activity_template_id', templateId)

  const oldTaskIds = (existingLinks ?? []).map((l) => l.template_task_id)

  await supabase.from('activity_template_groups').delete().eq('activity_template_id', templateId)
  await supabase.from('activity_template_tasks').delete().eq('activity_template_id', templateId)
  await supabase.from('template_rewards').delete().eq('activity_template_id', templateId)

  if (oldTaskIds.length > 0) {
    await supabase.from('template_task_groups').delete().in('template_task_id', oldTaskIds)
    await supabase.from('template_tasks').delete().in('id', oldTaskIds)
  }

  if (groupType === 'custom' && groups && groups.length > 0) {
    const { error } = await supabase.from('activity_template_groups').insert(
      groups.map((g, i) => ({
        activity_template_id: templateId,
        name: g.name,
        color: g.color,
        sort_order: i + 1,
      })),
    )
    if (error) throw error
  }

  const actions = actionsRes ?? []
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    const { data: task, error: taskError } = await supabase
      .from('template_tasks')
      .insert({
        name: action.name,
        points: action.points,
        description: action.description ?? null,
        max_completions: action.max_completions ?? null,
        sort_order: i + 1,
      })
      .select('id')
      .single()

    if (taskError || !task) throw taskError ?? new Error('Failed to create template task')

    const { error: linkError } = await supabase.from('activity_template_tasks').insert({
      activity_template_id: templateId,
      template_task_id: task.id,
      sort_order: i + 1,
    })
    if (linkError) throw linkError

    const actionGroups = (action.action_groups as unknown as ActionGroupJoin[]) ?? []
    if (actionGroups.length > 0) {
      const { error: groupLinkError } = await supabase.from('template_task_groups').insert(
        actionGroups.map((ag) => ({
          template_task_id: task.id,
          group_name: ag.groups.name,
        })),
      )
      if (groupLinkError) throw groupLinkError
    }
  }

  const uniqueRewards = dedupeByName(rewards ?? [])
  if (uniqueRewards.length > 0) {
    const { error } = await supabase.from('template_rewards').insert(
      uniqueRewards.map((r, i) => ({
        activity_template_id: templateId,
        name: r.name,
        required_points: r.required_points,
        sort_order: i + 1,
      })),
    )
    if (error) throw error
  }
}

export async function setTemplateActive(templateId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('activity_templates')
    .update({ is_active: isActive })
    .eq('id', templateId)

  if (error) throw error
}

export async function deleteActivityTemplate(templateId: string): Promise<void> {
  const { data: template } = await supabase
    .from('activity_templates')
    .select('draft_event_id')
    .eq('id', templateId)
    .single()

  const { error } = await supabase.from('activity_templates').delete().eq('id', templateId)
  if (error) throw error

  if (template?.draft_event_id) {
    await supabase.from('events').update({ status: 'archived' }).eq('id', template.draft_event_id)
  }
}

export async function applyActivityTemplate(
  eventId: string,
  template: ActivityTemplateWithContent,
): Promise<void> {
  const trimmedName = template.name.trim()
  if (trimmedName) {
    const { data: eventRow } = await supabase.from('events').select('name').eq('id', eventId).single()
    if (eventRow && !eventRow.name?.trim()) {
      const { error: nameError } = await supabase
        .from('events')
        .update({ name: trimmedName })
        .eq('id', eventId)
      if (nameError) throw nameError
    }
  }

  const groupNameToId = new Map<string, string>()
  if (template.group_type === 'custom' && template.groups.length > 0) {
    const { data: insertedGroups, error } = await supabase
      .from('groups')
      .insert(template.groups.map((g) => ({ event_id: eventId, name: g.name, color: g.color })))
      .select('id, name')
    if (error) throw error
    for (const g of insertedGroups ?? []) groupNameToId.set(g.name, g.id)
  }

  const actionNameToId = new Map<string, string>()
  if (template.tasks.length > 0) {
    const { data: insertedActions, error } = await supabase
      .from('actions')
      .insert(
        template.tasks.map((t) => ({
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

  const actionGroupRows: { action_id: string; group_id: string }[] = []
  for (const task of template.tasks) {
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

  const uniqueRewards = dedupeByName(template.rewards)
  if (uniqueRewards.length > 0) {
    const { error } = await supabase.from('rewards').insert(
      uniqueRewards.map((r) => ({
        event_id: eventId,
        name: r.name,
        required_points: r.required_points,
      })),
    )
    if (error) throw error
  }
}

/** Apply a template to an event, always loading the latest content from the DB. */
export async function applyActivityTemplateById(eventId: string, templateId: string): Promise<ActivityTemplateWithContent> {
  const template = await fetchActivityTemplateById(templateId)
  if (!template) throw new Error('Template not found')
  await applyActivityTemplate(eventId, template)
  return template
}

export function templateGroupType(template: ActivityTemplateWithContent): GroupType {
  return template.group_type as GroupType
}

function isMissingSeedRpcError(message: string): boolean {
  return (
    message.includes('Could not find the function') ||
    message.includes('PGRST202') ||
    (message.includes('seed_template_draft_event') && message.includes('does not exist'))
  )
}

async function clearDraftEventContent(eventId: string): Promise<void> {
  const { data: actions } = await supabase.from('actions').select('id').eq('event_id', eventId)
  const actionIds = (actions ?? []).map((a) => a.id)
  if (actionIds.length > 0) {
    await supabase.from('action_groups').delete().in('action_id', actionIds)
    await supabase.from('actions').delete().eq('event_id', eventId)
  }
  await supabase.from('groups').delete().eq('event_id', eventId)
  await supabase.from('rewards').delete().eq('event_id', eventId)
}

/** Copy template content into a draft event. Uses DB RPC when available, client fallback otherwise. */
export async function seedTemplateDraftEvent(
  templateId: string,
  eventId: string,
  template: ActivityTemplateWithContent,
): Promise<void> {
  const { error: rpcError } = await supabase.rpc('seed_template_draft_event', {
    p_template_id: templateId,
    p_event_id: eventId,
  })

  if (!rpcError) return

  const msg = rpcError.message ?? ''
  if (!isMissingSeedRpcError(msg)) throw rpcError

  const { error: linkError } = await supabase
    .from('activity_templates')
    .update({ draft_event_id: eventId })
    .eq('id', templateId)

  if (linkError) throw linkError

  await clearDraftEventContent(eventId)
  await applyActivityTemplate(eventId, template)
}

export function formatTemplateError(err: unknown, fallback: string): string {
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: string }).message)
      : ''

  if (!message) return fallback
  if (message.includes('draft_event_id') || message.includes('column')) {
    return `${fallback} הריצי את migration 030 ב-Supabase.`
  }
  if (message.includes('PLAN_LIMIT_REACHED')) {
    return `${fallback} הריצי migrations 031 ו-032 ב-Supabase.`
  }
  if (message.includes('seed_template_draft_event') || message.includes('Could not find the function')) {
    return `${fallback} הריצי migration 032 ב-Supabase.`
  }
  return `${fallback} (${message})`
}

export async function fetchTemplateDraftEventIds(): Promise<string[]> {
  const { data } = await supabase
    .from('activity_templates')
    .select('draft_event_id')
    .not('draft_event_id', 'is', null)

  return (data ?? []).map((row) => row.draft_event_id as string)
}
