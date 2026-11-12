import { useState, useRef, useCallback, useLayoutEffect, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { positionFloatingPanel } from '@/lib/floatingPanel'
import { DropdownHeader } from '@/components/ui/DropdownPanel'
import { theme } from '@/lib/theme'

export interface SecretOwnerOption {
  id: string
  name: string
}

const PANEL_WIDTH = 220
const PANEL_GAP = 4
const PANEL_EST_HEIGHT = 260
const VIEWPORT_PADDING = 8
/** A roster can be hundreds long; the search narrows it, the list stays short. */
const MAX_LISTED = 60

/**
 * Whose secret mission this is. Used in the add field, where the mission is
 * made, and on the task row, where it can be handed to someone else. Nobody
 * picked is a state the row has to show: until someone is, nobody can score
 * the task and the scan screen does not advertise it.
 */
export function SecretOwnerPicker({
  ownerId,
  participants,
  disabled,
  onPick,
  tone = 'onColor',
}: {
  ownerId: string | null
  participants: SecretOwnerOption[]
  disabled?: boolean
  onPick: (participantId: string) => void
  /** 'field' sits in the light add field; 'onColor' on a task row. */
  tone?: 'onColor' | 'field'
}) {
  const owner = ownerId ? participants.find((p) => p.id === ownerId) ?? null : null
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const panel = panelRef.current
    const { top, left } = positionFloatingPanel(
      rect,
      { width: panel?.offsetWidth || PANEL_WIDTH, height: panel?.offsetHeight || PANEL_EST_HEIGHT },
      { gap: PANEL_GAP, viewportPadding: VIEWPORT_PADDING },
    )
    setPanelStyle({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null)
      setQuery('')
      return
    }
    updatePosition()
    const frame = requestAnimationFrame(() => {
      updatePosition()
      searchRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? participants.filter((p) => p.name.toLowerCase().includes(q)) : participants
    return list.slice(0, MAX_LISTED)
  }, [participants, query])

  function pick(id: string) {
    onPick(id)
    setOpen(false)
  }

  return (
    <div className="relative flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="של מי המשימה הסודית"
        className={cn(
          tone === 'field'
            ? cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-surface px-3 text-xs font-semibold transition-colors hover:border-accent',
                owner ? 'border-border text-foreground' : 'border-border text-muted',
              )
            : cn(
                theme.wizardCompactChip,
                owner
                  ? 'border-white/50 bg-white/20 text-white hover:bg-white/30'
                  : 'border-white bg-white/90 text-danger-text hover:bg-white',
              ),
        )}
      >
        {!owner && tone === 'onColor' && <AlertTriangle size={10} strokeWidth={2.5} className="shrink-0" aria-hidden />}
        {tone === 'field' && <span aria-hidden>🤫</span>}
        <span className="min-w-0 max-w-[140px] truncate">
          {owner ? `של ${owner.name}` : tone === 'field' ? 'של מי המשימה?' : 'בחרו של מי'}
        </span>
        <ChevronDown className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="בחירת המשתתף/ת שהמשימה הסודית שלו/ה"
          style={{
            position: 'fixed',
            top: panelStyle?.top ?? -9999,
            left: panelStyle?.left ?? 0,
            width: PANEL_WIDTH,
            visibility: panelStyle ? 'visible' : 'hidden',
          }}
          className="z-[100] rounded-xl border border-border bg-surface py-1 shadow-dropdown animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <DropdownHeader>של מי המשימה הסודית?</DropdownHeader>
          {participants.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted">
              עדיין אין משתתפים במשחק. הוסיפו משתתפים ואז חזרו לבחור.
            </p>
          ) : (
            <>
              <div className="px-2 pb-1">
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-2">
                  <Search size={12} className="shrink-0 text-muted" aria-hidden />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && matches.length > 0) {
                        e.preventDefault()
                        pick(matches[0].id)
                      }
                    }}
                    placeholder="חיפוש משתתף/ת"
                    className="w-full min-w-0 bg-transparent py-1.5 text-xs text-foreground outline-none placeholder:text-muted"
                  />
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {matches.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted">אין משתתף/ת בשם הזה</p>
                )}
                {matches.map((p) => {
                  const selected = p.id === owner?.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pick(p.id)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-right text-xs font-medium transition-colors hover:bg-surface-elevated',
                        selected ? 'text-foreground' : 'text-muted',
                      )}
                    >
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
                        {selected && <Check size={11} strokeWidth={3} className="text-primary" />}
                      </span>
                      <span className="min-w-0 truncate">{p.name}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
