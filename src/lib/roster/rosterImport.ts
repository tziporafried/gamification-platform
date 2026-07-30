/**
 * Writes a reviewed roster plan to the database.
 *
 * Prefers the `import_event_roster` RPC (migration 073): one round trip, and
 * one transaction, so a plan-limit rejection leaves nothing half-imported. When
 * that migration has not been applied yet the same work runs from the client -
 * participants one at a time, because the `participants_auto_code` trigger
 * derives each external_id from the rows already committed.
 *
 * The name goes over in two parts as well as joined, so that neither an older
 * database nor an older client has a broken state - see the payload below.
 */

import { supabase } from '@/lib/supabase'
import { getNextPresetColor } from '@/lib/paletteColors'
import { isPlanLimitError } from '@/lib/plans'
import { nameKey, type RosterPlan } from './rosterPlan'
import type { Group } from '@/types'

/**
 * What an uploaded file does to the roster already in the event.
 *
 * `merge` adds the names that are new and leaves everyone else untouched - the
 * only thing an import ever did before, and the default. `replace` makes the
 * file the whole roster: everybody currently in the event is deleted first, and
 * their scans and rewards go with them (both CASCADE off participants). The
 * dialog says so in those words before it offers the choice.
 */
export type RosterImportMode = 'merge' | 'replace'

export interface RosterImportResult {
  participantsCreated: number
  /** Removed by a `replace`; always 0 after a merge. */
  participantsDeleted: number
  groupsCreated: number
  /** Rows the plan already decided to skip (duplicates / existing names). */
  skipped: number
  /** True when the event's participant cap stopped the import. */
  planLimitReached: boolean
}

export interface NewGroupSpec {
  name: string
  color: string
}

interface ImportOptions {
  /** Reports progress of the client fallback path only. */
  onProgress?: (done: number, total: number) => void
  /** Defaults to 'merge' - the behaviour every import had before the choice existed. */
  mode?: RosterImportMode
}

function isMissingRpcError(message: string): boolean {
  return (
    message.includes('Could not find the function') ||
    message.includes('PGRST202') ||
    (message.includes('import_event_roster') && message.includes('does not exist'))
  )
}

/** Assigns each new group a preset colour that is not already taken. */
export function colorsForNewGroups(newGroups: string[], usedColors: string[]): NewGroupSpec[] {
  const used = [...usedColors]
  return newGroups.map((name) => {
    const color = getNextPresetColor(used)
    used.push(color)
    return { name, color }
  })
}

/**
 * Rows per RPC call. Kept well under the statement timeout Supabase applies to
 * the `authenticated` role - a single call for a 2,000-row roster would risk
 * being cut off mid-import. Each call is still its own transaction, and the
 * import is keyed by name, so a retry never duplicates anyone.
 */
const CHUNK_SIZE = 200

export async function importRoster(
  eventId: string,
  plan: RosterPlan,
  usedColors: string[],
  options: ImportOptions = {},
): Promise<RosterImportResult> {
  const groups = colorsForNewGroups(plan.newGroups, usedColors)
  // Every row carries both shapes of the name: the two parts, and the two
  // joined. A pre-083 function reads `name` and ignores keys it has never heard
  // of, so an updated client against an older database still imports the whole
  // roster - it just stores each name undivided. From 083 the parts win.
  //
  // The groups go the same way. `groups` is the whole list and is what 087
  // reads; `group` beside it is the first of them, which is all an older
  // function can put anybody in. So a row naming two groups against a database
  // that has not had 087 applied lands the participant in the first one rather
  // than failing or inventing a group called "קבוצה א, קבוצה ב".
  //
  // A row with no phone omits the key rather than sending an empty one: the
  // same rows the import always sent, which is what the pre-081 function reads.
  const rows = plan.entries.map((entry) => {
    const row: Record<string, string | string[]> = {
      name: entry.name,
      first_name: entry.firstName,
      last_name: entry.lastName,
      group: entry.groups[0] ?? '',
      groups: entry.groups,
    }
    if (entry.phone !== '') row.phone = entry.phone
    return row
  })
  const skipped = plan.duplicateRows + plan.alreadyInEventRows + plan.invalidRows

  let participantsCreated = 0
  let participantsDeleted = 0
  let groupsCreated = 0
  let done = 0
  // The groups ride along with the first call so they exist before any row
  // referencing them is inserted.
  let pendingGroups = groups
  // And so does the replace - on the first call and never again. A 2,000-name
  // roster goes up in ten calls, and asking the second one to clear the event
  // would delete the 200 names the first one just wrote.
  let pendingReplace = options.mode === 'replace'

  for (let start = 0; start === 0 || start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE)

    // `p_replace` is sent only when it is true. PostgREST matches a function by
    // the argument names it is given, so a merge that named a fourth argument
    // would find nothing on a database still on the three-argument version and
    // drop the whole import to the client fallback. Merging keeps the old call
    // and works against either; only a replace needs 085 to be applied.
    const { data, error } = await supabase.rpc('import_event_roster', {
      p_event_id: eventId,
      p_groups: pendingGroups,
      p_rows: chunk,
      ...(pendingReplace ? { p_replace: true } : {}),
    })

    if (error) {
      const message = error.message ?? ''
      if (isPlanLimitError(message)) {
        return { participantsCreated, participantsDeleted, groupsCreated, skipped, planLimitReached: true }
      }
      if (isMissingRpcError(message) && start === 0) {
        return importRosterFromClient(eventId, plan, groups, options)
      }
      throw error
    }

    const summary = (data ?? {}) as {
      participants_created?: number
      participants_deleted?: number
      groups_created?: number
    }
    participantsCreated += summary.participants_created ?? chunk.length
    participantsDeleted += summary.participants_deleted ?? 0
    groupsCreated += summary.groups_created ?? pendingGroups.length
    pendingGroups = []
    pendingReplace = false

    done += chunk.length
    options.onProgress?.(done, rows.length)
  }

  return { participantsCreated, participantsDeleted, groupsCreated, skipped, planLimitReached: false }
}

async function importRosterFromClient(
  eventId: string,
  plan: RosterPlan,
  newGroups: NewGroupSpec[],
  options: ImportOptions,
): Promise<RosterImportResult> {
  let groupsCreated = 0
  let participantsDeleted = 0

  // Without the RPC there is no transaction to put this inside, so a replace
  // that fails later leaves the event emptied. It is still the operation the
  // operator asked for, and refusing it on an un-migrated database would mean
  // the option silently does nothing - which is worse than doing it plainly.
  if (options.mode === 'replace') {
    const { data, error } = await supabase
      .from('participants')
      .delete()
      .eq('event_id', eventId)
      .select('id')
    if (error) throw error
    participantsDeleted = (data ?? []).length
  }

  if (newGroups.length > 0) {
    const { data, error } = await supabase
      .from('groups')
      .insert(newGroups.map((group) => ({ event_id: eventId, name: group.name, color: group.color })))
      .select('id')
    if (error) throw error
    groupsCreated = (data ?? []).length
  }

  const { data: allGroups, error: groupsError } = await supabase
    .from('groups')
    .select('id, name')
    .eq('event_id', eventId)
  if (groupsError) throw groupsError

  const groupIdByName = new Map(
    ((allGroups ?? []) as Pick<Group, 'id' | 'name'>[]).map((group) => [nameKey(group.name), group.id]),
  )
  const allGroupIds = ((allGroups ?? []) as Pick<Group, 'id'>[]).map((group) => group.id)

  const links: { participant_id: string; group_id: string }[] = []
  let participantsCreated = 0
  const total = plan.entries.length

  // The joined name and nothing else. This path only runs when the import RPC
  // is missing altogether, which means a database from before 073 - and one
  // that old has no first_name column to write the parts into either.
  for (const entry of plan.entries) {
    const { data, error } = await supabase
      .from('participants')
      .insert(
        entry.phone === ''
          ? { event_id: eventId, name: entry.name }
          : { event_id: eventId, name: entry.name, phone: entry.phone },
      )
      .select('id')
      .single()

    if (error) {
      if (isPlanLimitError(error.message)) {
        await linkParticipants(links)
        return {
          participantsCreated,
          participantsDeleted,
          groupsCreated,
          skipped: plan.duplicateRows + plan.alreadyInEventRows + plan.invalidRows,
          planLimitReached: true,
        }
      }
      throw error
    }

    participantsCreated++
    options.onProgress?.(participantsCreated, total)

    // No group named in the file means "belongs everywhere", matching how a
    // manually added participant defaults to every group. Several named means
    // several memberships - participant_groups is many-to-many.
    const targetIds = entry.groups.length === 0
      ? allGroupIds
      : entry.groups
          .map((group) => groupIdByName.get(nameKey(group)))
          .filter((id): id is string => Boolean(id))

    for (const groupId of targetIds) {
      links.push({ participant_id: data.id, group_id: groupId })
    }
  }

  await linkParticipants(links)

  return {
    participantsCreated,
    participantsDeleted,
    groupsCreated,
    skipped: plan.duplicateRows + plan.alreadyInEventRows + plan.invalidRows,
    planLimitReached: false,
  }
}

async function linkParticipants(links: { participant_id: string; group_id: string }[]): Promise<void> {
  const CHUNK = 500
  for (let i = 0; i < links.length; i += CHUNK) {
    const { error } = await supabase.from('participant_groups').insert(links.slice(i, i + CHUNK))
    if (error) throw error
  }
}
