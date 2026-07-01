import { useState, useRef, useCallback } from 'react'
import { Repeat, RotateCcw, Hash, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/useClickOutside'
import { DropdownDivider, DropdownHeader, DropdownPanel } from '@/components/ui/DropdownPanel'
import { ChipButton } from '@/components/ui/ChipButton'

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
}: TaskLimitSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closeSelect = useCallback(() => { setOpen(false); onSetEditingLimit(false) }, [onSetEditingLimit])
  useClickOutside(ref, closeSelect)

  const unlimitedLabel = 'ניתן לבצע ללא הגבלה'
  const limitTooltip = 'כמה פעמים כל משתתף יכול לבצע את הפעילות'

  const label = limitMode === 'unlimited' ? unlimitedLabel
    : limitMode === 'once' ? 'פעם אחת'
    : `${customLimit} פעמים`

  const Icon = limitMode === 'unlimited' ? Repeat : limitMode === 'once' ? RotateCcw : Hash
  const chipColor = limitMode === 'unlimited' ? 'accent' as const
    : limitMode === 'once' ? 'amber' as const
    : 'cyan' as const

  return (
    <div ref={ref} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <ChipButton color={chipColor} onClick={() => setOpen(!open)} title={limitTooltip} className="max-w-[9rem]">
        <Icon size={10} className="shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </ChipButton>

      {open && (
        <DropdownPanel width="w-52">
          <DropdownHeader>כמה פעמים כל משתתף יכול לבצע</DropdownHeader>
          <button
            onClick={() => { onSaveLimitMode('unlimited'); setOpen(false) }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-elevated',
              limitMode === 'unlimited' ? 'text-accent' : 'text-muted',
            )}
          >
            <Repeat size={12} className="shrink-0" />
            <div className="text-right">
              <div>{unlimitedLabel}</div>
              <div className="text-[10px] font-normal text-muted">ניתן לבצע כמה פעמים שרוצים</div>
            </div>
          </button>
          <button
            onClick={() => { onSaveLimitMode('once'); setOpen(false) }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-elevated',
              limitMode === 'once' ? 'text-warning' : 'text-muted',
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
              <Hash size={12} className="shrink-0 text-secondary" />
              <input
                ref={limitRef}
                type="number"
                min={2}
                value={customLimit}
                onChange={(e) => onSetCustomLimit(Math.max(2, parseInt(e.target.value, 10) || 2))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onSaveLimitMode('limited', Math.max(2, customLimit)); onSetEditingLimit(false); setOpen(false) }
                  if (e.key === 'Escape') { onSetEditingLimit(false); onResetLimit() }
                }}
                onBlur={() => { onSaveLimitMode('limited', Math.max(2, customLimit)); onSetEditingLimit(false) }}
                className="w-12 rounded border border-secondary bg-surface-elevated px-1.5 py-0.5 text-xs text-center font-medium text-foreground outline-none"
                autoFocus
              />
              <span className="text-xs text-muted">פעמים</span>
            </div>
          ) : (
            <button
              onClick={() => { onSaveLimitMode('limited'); onSetEditingLimit(true) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-elevated',
                limitMode === 'limited' ? 'text-secondary' : 'text-muted',
              )}
            >
              <Hash size={12} className="shrink-0" />
              <div className="text-right">
                <div>{limitMode === 'limited' ? `${customLimit} פעמים` : 'מוגבל...'}</div>
                <div className="text-[10px] font-normal text-muted">הגדר מספר מרבי של ביצועים</div>
              </div>
            </button>
          )}
        </DropdownPanel>
      )}
    </div>
  )
}
