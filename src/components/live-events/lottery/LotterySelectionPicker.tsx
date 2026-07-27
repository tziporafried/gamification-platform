import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronUp, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SETTINGS_INLINE_BUTTON } from './LotterySettingsBar'

export interface SelectionOption {
  id: string
  label: string
  /** Secondary text - a points total, a member count. */
  hint?: string
  /** Group colour, shown as a dot. */
  color?: string
}

interface LotterySelectionPickerProps {
  /** What the trigger says when nothing is picked yet. */
  placeholder: string
  /** Noun for the summary line: "3 משתתפים" / "2 קבוצות". */
  noun: string
  options: readonly SelectionOption[]
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
  loading: boolean
  /** Shown inside the panel when the game has none of these to offer. */
  emptyText: string
  /** Adds a search box - worth it for players, not for a handful of groups. */
  searchable?: boolean
}

/**
 * Picks the players or the groups that are in the lottery.
 *
 * The trigger lives inside the "לפי קבוצות" segment, so it is sized to sit in
 * one. The panel opens *upward*: the settings bar is pinned to the bottom of
 * the screen, so one that dropped down would open off-screen.
 */
export function LotterySelectionPicker({
  placeholder,
  noun,
  options,
  selected,
  onChange,
  loading,
  emptyText,
  searchable = false,
}: LotterySelectionPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Click-outside and Escape. Bound only while open, so the dock is not
  // listening on the document for a panel nobody has opened.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // The lottery screen closes on Escape too; this panel is the innermost
      // thing open, so it takes the key and leaves the screen alone.
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  useEffect(() => {
    if (open && searchable) requestAnimationFrame(() => searchRef.current?.focus())
    if (!open) setQuery('')
  }, [open, searchable])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const summary = selected.size > 0 ? `${selected.size.toLocaleString('he-IL')} ${noun}` : placeholder

  return (
    <div ref={rootRef} className="relative flex min-w-0 items-center gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          SETTINGS_INLINE_BUTTON,
          'min-w-0',
          selected.size > 0
            ? 'border border-primary/35 bg-white text-primary shadow-sm'
            : 'border border-primary/25 bg-primary/[0.07] text-primary',
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronUp
          size={12}
          strokeWidth={2.75}
          className={cn('shrink-0 transition-transform', !open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {selected.size > 0 && (
        <button
          type="button"
          onClick={() => onChange(new Set())}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-current opacity-50 transition-opacity hover:opacity-100"
          title="נקו את הבחירה"
        >
          <X size={12} strokeWidth={2.75} aria-hidden="true" />
        </button>
      )}

      {open && (
        <div
          className={cn(
            'absolute bottom-full end-0 z-50 mb-2 w-72 overflow-hidden rounded-2xl',
            'border border-white/70 bg-white/95 shadow-[0_-10px_34px_rgba(46,34,30,0.16)] backdrop-blur-xl',
          )}
          role="listbox"
          aria-multiselectable="true"
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-black/[0.06] px-3 py-2">
              <Search size={14} strokeWidth={2.5} className="shrink-0 text-muted" aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש…"
                className={cn(
                  'w-full border-0 bg-transparent p-0 text-sm font-bold text-foreground',
                  'placeholder:font-semibold placeholder:text-muted/70 focus:outline-none',
                )}
              />
            </div>
          )}

          <div className="max-h-[38vh] overflow-y-auto py-1">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm font-semibold text-muted">טוען…</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm font-semibold text-muted">{emptyText}</p>
            ) : visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm font-semibold text-muted">אין תוצאות</p>
            ) : (
              visible.map((option) => {
                const isSelected = selected.has(option.id)
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(option.id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-right transition-colors',
                      isSelected ? 'bg-primary/[0.07]' : 'hover:bg-black/[0.04]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        isSelected
                          ? 'border-primary bg-primary text-white'
                          : 'border-black/20 bg-white',
                      )}
                      aria-hidden="true"
                    >
                      {isSelected && <Check size={11} strokeWidth={3.5} />}
                    </span>
                    {option.color && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: option.color }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                      {option.label}
                    </span>
                    {option.hint && (
                      <span className="shrink-0 text-xs font-bold tabular-nums text-muted">
                        {option.hint}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {options.length > 0 && !loading && (
            <div className="flex items-center justify-between border-t border-black/[0.06] px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange(new Set(visible.map((o) => o.id)))}
                className="rounded-md px-2 py-1 text-xs font-black text-primary hover:bg-primary/[0.08]"
              >
                בחרו הכל
              </button>
              <span className="text-xs font-bold tabular-nums text-muted">
                {selected.size.toLocaleString('he-IL')} נבחרו
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
