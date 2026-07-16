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

/**
 * Merge UTM blobs: keys present in `incoming` overwrite; absent keys keep `base`.
 * Avoids wiping utm_content when a later URL only carries utm_source.
 */
export function mergeUtmAttribution(
  base: UtmAttribution,
  incoming: UtmAttribution,
): UtmAttribution {
  const out: UtmAttribution = { ...base }
  for (const key of UTM_PARAM_KEYS) {
    if (incoming[key]) out[key] = incoming[key]
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

function searchParamsFrom(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
}

/** True when the URL is missing any attribution keys we already have. */
export function searchNeedsUtmPersist(search: string, utm: UtmAttribution): boolean {
  if (!hasUtmAttribution(utm)) return false
  const params = searchParamsFrom(search)
  return UTM_PARAM_KEYS.some((key) => Boolean(utm[key]) && !params.get(key))
}

/**
 * Merge persisted UTM into a query string without overwriting params already in the URL.
 * Preserves unrelated query keys (e.g. OAuth `code`, plan deep-links).
 */
export function withPersistedUtmSearch(search: string, utm: UtmAttribution): string {
  if (!hasUtmAttribution(utm)) {
    const trimmed = search.startsWith('?') ? search : search ? `?${search}` : ''
    return trimmed === '?' ? '' : trimmed
  }
  const params = searchParamsFrom(search)
  for (const key of UTM_PARAM_KEYS) {
    const value = utm[key]
    if (!value) continue
    if (!params.get(key)) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
