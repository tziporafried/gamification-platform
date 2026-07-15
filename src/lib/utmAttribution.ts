export type UtmParamKey = 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content'

export type UtmAttribution = Partial<Record<UtmParamKey, string>>

export const UTM_PARAM_KEYS: readonly UtmParamKey[] = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
]

/** Strip empty / obvious PII-like values; keep short attribution tokens only. */
export function sanitizeUtmValue(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim().slice(0, 100)
  if (!trimmed) return undefined
  if (/@/.test(trimmed) || /^\+?\d{7,}$/.test(trimmed)) return undefined
  return trimmed
}

/** Read only UTM params that exist in the query string — never invent defaults. */
export function readUtmFromSearch(search: string): UtmAttribution | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const next: UtmAttribution = {}
  let found = false
  for (const key of UTM_PARAM_KEYS) {
    const value = sanitizeUtmValue(params.get(key))
    if (value) {
      next[key] = value
      found = true
    }
  }
  return found ? next : null
}

/** Normalize persisted attribution — only keys with real values. */
export function normalizeUtmAttribution(raw: unknown): UtmAttribution {
  if (!raw || typeof raw !== 'object') return {}
  const parsed = raw as Record<string, unknown>
  const out: UtmAttribution = {}
  for (const key of UTM_PARAM_KEYS) {
    const value = sanitizeUtmValue(typeof parsed[key] === 'string' ? parsed[key] : null)
    if (value) out[key] = value
  }
  return out
}

/** Event params to attach — omits absent UTM keys entirely. */
export function utmAttributionToParams(utm: UtmAttribution): Record<string, string> {
  const params: Record<string, string> = {}
  for (const key of UTM_PARAM_KEYS) {
    if (utm[key]) params[key] = utm[key]!
  }
  return params
}

/** True when at least one supported UTM param is present. */
export function hasUtmAttribution(utm: UtmAttribution): boolean {
  return UTM_PARAM_KEYS.some((key) => Boolean(utm[key]))
}
