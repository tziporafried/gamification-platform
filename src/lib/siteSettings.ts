import { supabase } from '@/lib/supabase'

/**
 * Site-wide settings a super admin changes from the admin panel without a
 * deploy. Stored as key/value rows in `site_settings` (migration 093).
 * Anyone - signed in or not - can read; only a super admin can write.
 */

export const ACTIVE_HOME_KEY = 'active_home_page'

/** How long `/` waits for the setting before falling back to the code default. */
const FETCH_TIMEOUT_MS = 1500

let activeHomeRequest: Promise<string | null> | null = null

function isMissingTable(message: string | undefined): boolean {
  return !!message && /site_settings/.test(message) && /(does not exist|schema cache|not find)/i.test(message)
}

async function queryActiveHome(): Promise<string | null> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', ACTIVE_HOME_KEY)
    .maybeSingle()
  if (error) {
    if (!isMissingTable(error.message)) console.warn('[siteSettings] active home:', error.message)
    return null
  }
  const value = (data as { value: string | null } | null)?.value
  return value && value.trim() ? value.trim() : null
}

/**
 * The homepage id chosen in the admin panel, or null when none is chosen (or
 * the request failed / timed out). Shared per page load, so returning to `/`
 * does not wait again.
 */
export function fetchActiveHomeId(): Promise<string | null> {
  if (!activeHomeRequest) {
    const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), FETCH_TIMEOUT_MS))
    activeHomeRequest = Promise.race([queryActiveHome(), timeout]).catch(() => null)
  }
  return activeHomeRequest
}

/** Admin panel: read without the timeout, surfacing errors. */
export async function loadActiveHomeIdForAdmin(): Promise<{ id: string | null; error: string | null; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', ACTIVE_HOME_KEY)
    .maybeSingle()
  if (error) {
    return { id: null, error: error.message, tableMissing: isMissingTable(error.message) }
  }
  const value = (data as { value: string | null } | null)?.value
  return { id: value && value.trim() ? value.trim() : null, error: null, tableMissing: false }
}

/** Admin panel: save a homepage id, or null to go back to the code default. */
export async function saveActiveHomeId(id: string | null, userId: string | null): Promise<string | null> {
  const { error } = id
    ? await supabase
        .from('site_settings')
        .upsert({ key: ACTIVE_HOME_KEY, value: id, updated_by: userId }, { onConflict: 'key' })
    : await supabase.from('site_settings').delete().eq('key', ACTIVE_HOME_KEY)
  if (error) return error.message
  activeHomeRequest = Promise.resolve(id)
  return null
}
