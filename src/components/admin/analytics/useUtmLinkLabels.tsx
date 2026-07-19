import { useCallback, useEffect, useState } from 'react'
import { Pencil, Check, X, Link2, Copy, CheckCheck, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

export interface UtmLinkLabel {
  id: string
  content_code: string
  display_name: string
}

/** Ambiguous-free charset for short opaque ids (no 0/o/1/l/i). */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

function normalizeCode(code: string): string {
  return code.trim().toLowerCase()
}

function normalizeDisplayName(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Group key for filters/tables: same display name → same group.
 * Unnamed codes stay separate (key = the code itself).
 */
export function affiliateGroupKey(code: string, label: string | null | undefined): string {
  const normalized = normalizeCode(code)
  const name = label?.trim()
  if (name) return `n:${normalizeDisplayName(name)}`
  return normalized
}

/** Expand selected group keys to concrete utm_content / source codes. */
export function expandAffiliateSelection(
  selected: string[],
  labelsByCode: Record<string, string>,
): string[] {
  if (selected.length === 0) return []
  const out = new Set<string>()
  for (const sel of selected) {
    if (sel.startsWith('n:')) {
      const nameKey = sel.slice(2)
      for (const [code, name] of Object.entries(labelsByCode)) {
        if (normalizeDisplayName(name) === nameKey) out.add(normalizeCode(code))
      }
    } else {
      out.add(normalizeCode(sel))
    }
  }
  return [...out]
}

function randomCode(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]
  }
  return out
}

export function buildShareHomeUrl(contentCode: string): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://example.com'
  const url = new URL('/', origin)
  url.searchParams.set('utm_source', 'share')
  url.searchParams.set('utm_content', normalizeCode(contentCode))
  return url.toString()
}

/** Load + save shared link code → display name maps (super-admin RLS). */
export function useUtmLinkLabels() {
  const { user } = useAuth()
  const [labelsByCode, setLabelsByCode] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('utm_link_labels')
      .select('id, content_code, display_name')
      .order('updated_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setLabelsByCode({})
      setLoading(false)
      return
    }

    const map: Record<string, string> = {}
    for (const row of (data as UtmLinkLabel[]) ?? []) {
      map[normalizeCode(row.content_code)] = row.display_name
    }
    setLabelsByCode(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const labelFor = useCallback(
    (code: string): string | null => {
      const name = labelsByCode[normalizeCode(code)]
      return name ? name : null
    },
    [labelsByCode],
  )

  const displayLabel = useCallback(
    (code: string): string => labelFor(code) ?? code,
    [labelFor],
  )

  const allocateUniqueCode = useCallback(async (taken: Set<string>): Promise<string> => {
    for (const len of [2, 3, 4]) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const code = randomCode(len)
        if (taken.has(code)) continue
        const { data } = await supabase
          .from('utm_link_labels')
          .select('id')
          .eq('content_code', code)
          .maybeSingle()
        if (!data) return code
        taken.add(code)
      }
    }
    return `x${Date.now().toString(36).slice(-5)}`
  }, [])

  async function saveLabel(contentCode: string, displayName: string) {
    if (!user) return { ok: false as const, error: 'יש להתחבר' }
    const code = normalizeCode(contentCode)
    const name = displayName.trim()
    if (!code) return { ok: false as const, error: 'חסר מזהה לינק' }

    setSavingCode(code)
    setError(null)

    if (!name) {
      const { error: delError } = await supabase
        .from('utm_link_labels')
        .delete()
        .eq('content_code', code)
      setSavingCode(null)
      if (delError) {
        setError(delError.message)
        return { ok: false as const, error: delError.message }
      }
      setLabelsByCode((prev) => {
        const next = { ...prev }
        delete next[code]
        return next
      })
      return { ok: true as const }
    }

    const existing = await supabase
      .from('utm_link_labels')
      .select('id')
      .eq('content_code', code)
      .maybeSingle()

    if (existing.data?.id) {
      const { error: updateError } = await supabase
        .from('utm_link_labels')
        .update({ display_name: name })
        .eq('id', existing.data.id)
      setSavingCode(null)
      if (updateError) {
        setError(updateError.message)
        return { ok: false as const, error: updateError.message }
      }
    } else {
      const { error: insertError } = await supabase.from('utm_link_labels').insert({
        content_code: code,
        display_name: name,
        created_by: user.id,
      })
      setSavingCode(null)
      if (insertError) {
        setError(insertError.message)
        return { ok: false as const, error: insertError.message }
      }
    }

    setLabelsByCode((prev) => ({ ...prev, [code]: name }))
    return { ok: true as const }
  }

  /**
   * Create an opaque share link for a human name and persist the mapping immediately
   * (before any GA4 events arrive).
   */
  async function createShareLink(displayName: string) {
    if (!user) return { ok: false as const, error: 'יש להתחבר' }
    const name = displayName.trim()
    if (!name) return { ok: false as const, error: 'יש להקליד שם ללינק' }

    setError(null)
    const taken = new Set(Object.keys(labelsByCode))
    const code = await allocateUniqueCode(taken)
    setSavingCode(code)

    const { error: insertError } = await supabase.from('utm_link_labels').insert({
      content_code: code,
      display_name: name,
      created_by: user.id,
    })

    setSavingCode(null)
    if (insertError) {
      if (insertError.code === '23505') {
        const retryCode = await allocateUniqueCode(new Set([...taken, code]))
        setSavingCode(retryCode)
        const { error: retryError } = await supabase.from('utm_link_labels').insert({
          content_code: retryCode,
          display_name: name,
          created_by: user.id,
        })
        setSavingCode(null)
        if (retryError) {
          setError(retryError.message)
          return { ok: false as const, error: retryError.message }
        }
        setLabelsByCode((prev) => ({ ...prev, [retryCode]: name }))
        return {
          ok: true as const,
          contentCode: retryCode,
          displayName: name,
          url: buildShareHomeUrl(retryCode),
        }
      }
      setError(insertError.message)
      return { ok: false as const, error: insertError.message }
    }

    setLabelsByCode((prev) => ({ ...prev, [code]: name }))
    return {
      ok: true as const,
      contentCode: code,
      displayName: name,
      url: buildShareHomeUrl(code),
    }
  }

  return {
    labelsByCode,
    loading,
    savingCode,
    error,
    labelFor,
    displayLabel,
    saveLabel,
    createShareLink,
    reload,
  }
}


export function UtmShareLinkGenerator({
  onCreated,
  createShareLink,
  generating,
  error,
  compact = false,
}: {
  onCreated?: (result: { contentCode: string; displayName: string; url: string }) => void
  createShareLink: (
    displayName: string,
  ) => Promise<
    | { ok: true; contentCode: string; displayName: string; url: string }
    | { ok: false; error: string }
  >
  generating?: boolean
  error?: string | null
  /** Inline row next to date filter — less vertical space */
  compact?: boolean
}) {
  const [name, setName] = useState('')
  const [lastUrl, setLastUrl] = useState<string | null>(null)
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    setCopied(false)
    setBusy(true)
    const result = await createShareLink(name)
    setBusy(false)
    if (!result.ok) {
      setLocalError(result.error)
      return
    }
    setLastUrl(result.url)
    setLastCode(result.contentCode)
    setName('')
    onCreated?.(result)
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard may be blocked */
    }
  }

  async function copyAgain() {
    if (!lastUrl) return
    try {
      await navigator.clipboard.writeText(lastUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setLocalError('לא ניתן להעתיק — העתיקו ידנית מהשדה')
    }
  }

  const showError = localError || error

  if (compact) {
    return (
      <div className="min-w-0 space-y-1.5">
        <form
          onSubmit={(e) => void handleGenerate(e)}
          className="flex min-w-0 flex-wrap items-center gap-1.5"
          title="שם → לינק שיתוף עם מזהה אקראי (utm_source=share)"
        >
          <span className="shrink-0 text-[11px] font-semibold text-muted">לינק</span>
          <input
            id="utm-link-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם אפיליאייט"
            required
            className={cn(
              'h-8 min-w-[8rem] flex-1 rounded-lg border border-border bg-surface px-2.5 text-xs text-foreground outline-none',
              'placeholder:text-muted focus:border-secondary',
            )}
          />
          <Button type="submit" size="xs" loading={busy || generating} className="shrink-0 gap-1">
            <Link2 size={12} />
            יצירה
          </Button>
          {lastUrl && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void copyAgain()}
              className="shrink-0 gap-1"
              title={lastUrl}
            >
              {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
              {lastCode ?? 'העתקה'}
            </Button>
          )}
        </form>
        {showError && <p className="text-[11px] text-danger-text">{showError}</p>}
        {lastUrl && !showError && (
          <p className="truncate font-mono text-[10px] text-muted" dir="ltr" title={lastUrl}>
            {lastUrl}
          </p>
        )}
      </div>
    )
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-secondary-text" />
        <h3 className="text-sm font-semibold text-foreground">יצירת לינק שיתוף</h3>
      </div>
      <p className="text-[11px] text-muted">
        מקלידים שם (למשל שם איש קשר) — המערכת יוצרת מזהה לא מזוהה, שומרת את המיפוי מיד, ומעתיקה
        לינק לדף הבית עם <span className="font-mono">utm_source=share</span>
      </p>
      <form
        onSubmit={(e) => void handleGenerate(e)}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <Input
            id="utm-link-name"
            label="שם ללינק"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="למשל: רותי שיף"
            required
          />
        </div>
        <Button type="submit" loading={busy || generating} className="shrink-0 sm:mb-0.5">
          <Link2 size={14} className="ml-1" />
          יצירת לינק
        </Button>
      </form>
      {showError && <p className="text-xs text-danger-text">{showError}</p>}
      {lastUrl && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-elevated/50 p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">
              מזהה: <span className="font-mono text-foreground">{lastCode}</span>
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-foreground" dir="ltr">
              {lastUrl}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyAgain()}>
            {copied ? <CheckCheck size={14} className="ml-1" /> : <Copy size={14} className="ml-1" />}
            {copied ? 'הועתק' : 'העתקה'}
          </Button>
        </div>
      )}
    </Card>
  )
}

export function LinkLabelEditor({
  contentCode,
  contentCodes,
  displayLabel,
  saving,
  onSave,
}: {
  contentCode: string
  /** When several codes share one name — edit each code separately to split. */
  contentCodes?: string[]
  displayLabel: string | null
  saving?: boolean
  /** Apply display names — same name keeps merge, different names split. */
  onSave: (updates: { code: string; name: string }[]) => Promise<void>
}) {
  const codes = contentCodes?.length ? contentCodes : [contentCode]
  const isMerged = codes.length > 1
  const codesLabel = codes.join(', ')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayLabel ?? '')
  const [draftByCode, setDraftByCode] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!editing) {
      setDraft(displayLabel ?? '')
      setDraftByCode(Object.fromEntries(codes.map((c) => [c, displayLabel ?? ''])))
    }
  }, [displayLabel, editing, codesLabel])

  function startEdit() {
    const initial = displayLabel ?? ''
    setDraft(initial)
    setDraftByCode(Object.fromEntries(codes.map((c) => [c, initial])))
    setEditing(true)
  }

  async function commit() {
    if (isMerged) {
      await onSave(
        codes.map((code) => ({
          code,
          name: (draftByCode[code] ?? '').trim(),
        })),
      )
    } else {
      await onSave([{ code: codes[0]!, name: draft.trim() }])
    }
    setEditing(false)
  }

  function cancel() {
    setDraft(displayLabel ?? '')
    setDraftByCode(Object.fromEntries(codes.map((c) => [c, displayLabel ?? ''])))
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <p className="min-w-0 truncate text-sm text-foreground">
          {displayLabel ? (
            <span className="font-medium">{displayLabel}</span>
          ) : (
            <span className="text-muted">ללא שם — לחצו לעריכה</span>
          )}
          <span className="mx-1.5 text-muted/50">·</span>
          <span className="font-mono text-[11px] text-muted" dir="ltr" title={codesLabel}>
            {codesLabel}
          </span>
        </p>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
          title={isMerged ? 'עריכה / פיצול שמות' : 'עריכת שם לינק'}
          aria-label={isMerged ? 'עריכה / פיצול שמות' : 'עריכת שם לינק'}
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      </div>
    )
  }

  if (isMerged) {
    return (
      <div className="min-w-[240px] space-y-2 py-0.5">
        <p className="text-[11px] leading-snug text-muted">
          שדה לכל קוד. שמות שונים = פיצול · אותו שם = נשאר מאוחד
        </p>
        {codes.map((code, index) => (
          <div key={code} className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 font-mono text-[11px] text-muted" dir="ltr">
              {code}
            </span>
            <input
              autoFocus={index === 0}
              value={draftByCode[code] ?? ''}
              disabled={saving}
              onChange={(e) =>
                setDraftByCode((prev) => ({ ...prev, [code]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void commit()
                }
                if (e.key === 'Escape') cancel()
              }}
              placeholder={`שם ל־${code}`}
              className={cn(
                'w-full min-w-0 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none',
                'focus:border-secondary',
                saving && 'opacity-60',
              )}
            />
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => void commit()}
            className="shrink-0 rounded-lg p-1.5 text-success-text hover:bg-surface-elevated"
            title="שמירה"
        aria-label="שמירה"
          >
            <Check size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={cancel}
            className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface-elevated hover:text-danger-text"
            title="ביטול"
        aria-label="ביטול"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-[180px] items-center gap-1.5">
      <input
        autoFocus
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit()
          }
          if (e.key === 'Escape') cancel()
        }}
        placeholder="שם אמיתי ללינק"
        className={cn(
          'w-full min-w-0 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground outline-none',
          'focus:border-secondary',
          saving && 'opacity-60',
        )}
      />
      <button
        type="button"
        disabled={saving}
        onClick={() => void commit()}
        className="shrink-0 rounded-lg p-1.5 text-success-text hover:bg-surface-elevated"
        title="שמירה"
        aria-label="שמירה"
      >
        <Check size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={cancel}
        className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface-elevated hover:text-danger-text"
        title="ביטול"
        aria-label="ביטול"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
