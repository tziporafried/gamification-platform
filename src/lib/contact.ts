/** Product intent — never mix contact help with activation/plan leads. */
export type ContactIntent =
  | 'contact'
  | 'plan_lead'
  | 'organization_lead'
  | 'plan_independent'
  | 'plan_offline'

/** Analytics / DB labeling for neutral contact (maps to limit_type). */
export type ContactSource = 'homepage_contact' | 'trial_contact' | 'custom_solution'

/** Page / surface the contact was opened from (stored in notes, not shown in UI). */
export type ContactPageSource =
  | 'home'
  | 'demo'
  | 'events'
  | 'wizard'
  | 'event'
  | 'control'
  | 'scan'
  | 'leaderboard'
  | 'settings'
  | 'floating'
  | 'faq'
  | 'footer'
  | 'pricing'
  | 'plans'

export type PendingActivation = {
  plan: 'independent' | 'full' | 'organizations' | 'offline'
  source?: string
}

const PENDING_ACTIVATION_KEY = 'gamify_pending_activation'

export function contactLimitTypeForSource(source: ContactSource): string {
  if (source === 'custom_solution') return 'plan-organizations'
  return source
}

export function limitTypeForIntent(intent: ContactIntent, contactSource?: ContactSource): string {
  switch (intent) {
    case 'contact':
      return contactSource ?? 'homepage_contact'
    case 'plan_lead':
      return 'plan-full'
    case 'organization_lead':
      return 'plan-organizations'
    case 'plan_independent':
      return 'plan-independent'
    case 'plan_offline':
      return 'plan-offline'
  }
}

/** Map a FloatingContactButton location to analytics ContactSource. */
export function contactSourceFromLocation(location: string): ContactSource {
  if (location === 'floating' || location === 'faq' || location === 'footer' || location === 'home') {
    return 'homepage_contact'
  }
  return 'trial_contact'
}

/** Map floating / page location to a page source tag for behind-the-scenes notes. */
export function pageSourceFromLocation(location: string): ContactPageSource {
  switch (location) {
    case 'floating':
    case 'faq':
    case 'footer':
    case 'home':
      return 'home'
    case 'events':
      return 'events'
    case 'wizard':
      return 'wizard'
    case 'control':
      return 'control'
    case 'scan':
    case 'kiosk':
      return 'scan'
    case 'leaderboard':
    case 'display':
      return 'leaderboard'
    case 'settings':
      return 'settings'
    case 'pricing':
    case 'plans':
      return 'pricing'
    default:
      return (location as ContactPageSource) || 'home'
  }
}

export function buildContextNotes(parts: {
  pageSource?: string | null
  eventName?: string | null
  route?: string | null
  mode?: string | null
  extras?: string[]
}): string | null {
  const lines: string[] = []
  if (parts.pageSource) lines.push(`source: ${parts.pageSource}`)
  if (parts.route) lines.push(`page: ${parts.route}`)
  if (parts.eventName) lines.push(`eventName: ${parts.eventName}`)
  if (parts.mode) lines.push(`mode: ${parts.mode}`)
  if (parts.extras?.length) lines.push(...parts.extras)
  return lines.length ? lines.join('\n') : null
}

export function setPendingActivation(pending: PendingActivation): void {
  try {
    sessionStorage.setItem(PENDING_ACTIVATION_KEY, JSON.stringify(pending))
  } catch {
    /* ignore quota / private mode */
  }
}

export function getPendingActivation(): PendingActivation | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ACTIVATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingActivation
    if (!parsed?.plan) return null
    return parsed
  } catch {
    return null
  }
}

export function clearPendingActivation(): void {
  try {
    sessionStorage.removeItem(PENDING_ACTIVATION_KEY)
  } catch {
    /* ignore */
  }
}
