import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Repeat, RotateCcw, Hash, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DropdownDivider, DropdownHeader } from '@/components/ui/DropdownPanel'
import { ChipButton } from '@/components/ui/ChipButton'
import { theme } from '@/lib/theme'

type LimitMode = 'unlimited' | 'once' | 'limited'

interface TaskLimitSelectProps {
  limitMode: LimitMode
  customLimit: number
  editingLimit: boolean
  limitRef: React.RefObject<HTMLInputElement>
  onSaveLimitMode: (mode: LimitMode, limit?: number) => void
  onSetEditingLimit: (v: boolean) => void
  onSetCustomLimit: (v: number) => void
  onResetLimit: () => void
  tone?: 'default' | 'onColor'
  size?: 'default' | 'compact'
}

const PANEL_WIDTH = 208

function clampPanelLeft(triggerLeft: number) {
  return Math.max(8, Math.min(triggerLeft, window.innerWidth - PANEL_WIDTH - 8))
}

export function TaskLimitSelect({
  limitMode,
  customLimit,
  editingLimit,
  limitRef,
  onSaveLimitMode,
  onSetEditingLimit,
  onSetCustomLimit,
  onResetLimit,
  tone = 'default',
  size = 'default',
}: TaskLimitSelectProps) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const unlimitedLabel = 'ניתן לבצע ללא הגבלה'
  const limitTooltip = 'כמה פעמים כל משתתף יכול לבצע את הפעילות'

  const label = limitMode === 'unlimited' ? unlimitedLabel
    : limitMode === 'once' ? 'פעם אחת'
    : `${customLimit} פעמים`

  const Icon = limitMode === 'unlimited' ? Repeat : limitMode === 'once' ? RotateCcw : Hash
  const compact = size === 'compact'

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setPanelStyle({
      top: rect.bottom + 4,
      left: clampPanelLeft(rect.left),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null)
      return
    }
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
      onSetEditingLimit(false)
    }

    function handleReposition() {
      updatePosition()
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, updatePosition, onSetEditingLimit])

  function close() {
    setOpen(false)
    onSetEditingLimit(false)
  }

  return (
    <div className="relative flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
      {tone === 'onColor' ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          title={limitTooltip}
          className={cn(
            compact ? theme.wizardCompactChip : 'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-normal transition-all',
            tone === 'onColor' && 'border-white/50 text-white bg-white/20 hover:bg-white/30',
          )}
        >
          <Icon className="shrink-0" strokeWidth={2} />
          <span className={cn(compact ? 'whitespace-nowrap' : 'truncate')}>{label}</span>
          <ChevronDown
            size={compact ? undefined : 12}
            className={cn('shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>
      ) : (
        <ChipButton
          ref={buttonRef}
          color="default"
          onClick={() => setOpen((prev) => !prev)}
          title={limitTooltip}
          className="max-w-[9rem]"
        >
          <Icon size={10} className="shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
        </ChipButton>
      )}

      {open && panelStyle && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: panelStyle.top, left: panelStyle.left, width: PANEL_WIDTH }}
          className={cn(
            'z-[100] rounded-xl border py-1 shadow-podium',
            'animate-[fade-in_150ms_ease-out,slide-down_150ms_ease-out]',
            theme.bgCard,
            theme.border,
          )}
        >
          <DropdownHeader>כמה פעמים כל משתתף יכול לבצע</DropdownHeader>
          <button
            onClick={() => { onSaveLimitMode('unlimited'); close() }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-elevated',
              limitMode === 'unlimited' ? 'text-foreground' : 'text-muted',
            )}
          >
            <Repeat size={12} className="shrink-0" />
            <div className="text-right">
              <div>{unlimitedLabel}</div>
              <div className="text-[10px] font-normal text-muted">ניתן לבצע כמה פעמים שרוצים</div>
            </div>
          </button>
          <button
            onClick={() => { onSaveLimitMode('once'); close() }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-elevated',
              limitMode === 'once' ? 'text-foreground' : 'text-muted',
            )}
          >
            <RotateCcw size={12} className="shrink-0" />
            <div className="text-right">
              <div>פעם אחת</div>
              <div className="text-[10px] font-normal text-muted">כל משתתף יכול לבצע פעם אחת בלבד</div>
            </div>
          </button>
          <DropdownDivider />
          {editingLimit ? (
            <div className="flex items-center gap-1.5 px-3 py-2">
              <Hash size={12} className="shrink-0 text-muted" />
              <input
                ref={limitRef}
                type="number"
                min={2}
                value={customLimit}
                onChange={(e) => onSetCustomLimit(Math.max(2, parseInt(e.target.value, 10) || 2))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onSaveLimitMode('limited', Math.max(2, customLimit)); close() }
                  if (e.key === 'Escape') { close(); onResetLimit() }
                }}
                onBlur={() => { onSaveLimitMode('limited', Math.max(2, customLimit)); onSetEditingLimit(false) }}
                className="w-12 rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-xs text-center font-medium text-foreground outline-none focus:border-tertiary"
                autoFocus
              />
              <span className="text-xs text-muted">פעמים</span>
            </div>
          ) : (
            <button
              onClick={() => { onSaveLimitMode('limited'); onSetEditingLimit(true) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-elevated',
                limitMode === 'limited' ? 'text-foreground' : 'text-muted',
              )}
            >
              <Hash size={12} className="shrink-0" />
              <div className="text-right">
                <div>{limitMode === 'limited' ? `${customLimit} פעמים` : 'מוגבל...'}</div>
                <div className="text-[10px] font-normal text-muted">הגדר מספר מרבי של ביצועים</div>
              </div>
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
