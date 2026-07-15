import { useCallback, useEffect, useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

export interface UtmLinkLabel {
  id: string
  content_code: string
  display_name: string
}

function normalizeCode(code: string): string {
  return code.trim().toLowerCase()
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

  return {
    labelsByCode,
    loading,
    savingCode,
    error,
    labelFor,
    displayLabel,
    saveLabel,
    reload,
  }
}

export function LinkLabelEditor({
  contentCode,
  displayLabel,
  saving,
  onSave,
}: {
  contentCode: string
  displayLabel: string | null
  saving?: boolean
  onSave: (name: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayLabel ?? '')

  useEffect(() => {
    if (!editing) setDraft(displayLabel ?? '')
  }, [displayLabel, editing])

  async function commit() {
    await onSave(draft)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 truncate text-sm text-foreground">
          {displayLabel ? (
            <span className="font-medium">{displayLabel}</span>
          ) : (
            <span className="text-muted">ללא שם — לחצו לעריכה</span>
          )}
          <span className="mx-1.5 text-muted/50">·</span>
          <span className="font-mono text-[11px] text-muted" dir="ltr">
            {contentCode}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
          title="עריכת שם לינק"
        >
          <Pencil size={14} />
        </button>
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
          if (e.key === 'Escape') {
            setDraft(displayLabel ?? '')
            setEditing(false)
          }
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
        className="shrink-0 rounded-lg p-1.5 text-success hover:bg-surface-elevated"
        title="שמירה"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => {
          setDraft(displayLabel ?? '')
          setEditing(false)
        }}
        className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface-elevated hover:text-danger"
        title="ביטול"
      >
        <X size={14} />
      </button>
    </div>
  )
}
