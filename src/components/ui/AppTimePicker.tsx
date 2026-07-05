import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPanelLeftAlignedToTriggerRight } from '@/lib/floatingPanel'
import { formatTimeOfDay } from '@/lib/israelTime'
import { QUARTER_HOUR_MINUTES, snapToQuarterHour } from '@/lib/taskLimit'
import { theme } from '@/lib/theme'

export interface TimeOfDayValue {
  hour: number
  minute: number
}

interface AppTimePickerProps {
  value: TimeOfDayValue
  onChange: (value: TimeOfDayValue) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onBlur?: () => void
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void
  className?: string
}

const HOURS = Array.from({ length: 24 }, (_, index) => index)
const MINUTES = [...QUARTER_HOUR_MINUTES]
const PANEL_WIDTH = 140
const PANEL_GAP = 4

function TimeColumn({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string
  values: number[]
  selected: number
  onSelect: (value: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const selectedEl = listRef.current?.querySelector('[data-selected="true"]')
    selectedEl?.scrollIntoView({ block: 'center' })
  }, [selected])

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className={cn('border-b px-2 py-1 text-center text-[10px] font-medium', theme.border, theme.textMuted)}>
        {label}
      </div>
      <div
        ref={listRef}
        className="h-32 overflow-y-auto overscroll-contain py-0.5"
      >
        {values.map((item) => {
          const isSelected = item === selected
          return (
            <button
              key={item}
              type="button"
              data-selected={isSelected}
              onClick={() => onSelect(item)}
              className={cn(
                'w-full px-2 py-1.5 text-center text-xs tabular-nums transition-colors',
                isSelected
                  ? 'bg-tertiary font-semibold text-white'
                  : cn(theme.text, 'hover:bg-surface-elevated'),
              )}
            >
              {item.toString().padStart(2, '0')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AppTimePicker({
  value,
  onChange,
  open: openProp,
  onOpenChange,
  onBlur,
  onKeyDown,
  className,
}: AppTimePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = openProp !== undefined
  const isOpen = isControlled ? openProp : internalOpen

  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)

  const setOpen = useCallback((next: boolean) => {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }, [isControlled, onOpenChange])

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current
    const panel = panelRef.current
    if (!button || !panel) return

    const rect = button.getBoundingClientRect()
    const panelHeight = panel.offsetHeight
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < panelHeight + PANEL_GAP + 8

    setPanelStyle({
      top: openUp ? rect.top - panelHeight - PANEL_GAP : rect.bottom + PANEL_GAP,
      left: getPanelLeftAlignedToTriggerRight(rect.right, PANEL_WIDTH, 8),
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) {
      setPanelStyle(null)
      return
    }
    updatePanelPosition()
  }, [isOpen, updatePanelPosition, value.hour, value.minute])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
      onBlur?.()
    }

    function handleReposition() {
      updatePanelPosition()
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen, onBlur, setOpen, updatePanelPosition])

  function selectHour(hour: number) {
    onChange({ ...value, hour })
  }

  function selectMinute(minute: number) {
    onChange({ ...value, minute })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      onBlur?.()
    }
    onKeyDown?.(event)
  }

  const selectedMinute = snapToQuarterHour(value.minute)

  const panel = isOpen ? (
    <div
      ref={panelRef}
      dir="ltr"
      style={{
        position: 'fixed',
        top: panelStyle?.top ?? -9999,
        left: panelStyle?.left ?? 0,
        width: PANEL_WIDTH,
        visibility: panelStyle ? 'visible' : 'hidden',
      }}
      className={cn(
        'z-[120] flex overflow-hidden rounded-xl border shadow-podium',
        theme.bgCard,
        theme.border,
        panelStyle && 'animate-[fade-in_150ms_ease-out,slide-down_150ms_ease-out]',
      )}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <TimeColumn label="שעה" values={HOURS} selected={value.hour} onSelect={selectHour} />
      <div className={cn('w-px shrink-0 bg-border', theme.border)} />
      <TimeColumn label="דקה" values={MINUTES} selected={selectedMinute} onSelect={selectMinute} />
    </div>
  ) : null

  return (
    <>
      <div ref={rootRef} dir="ltr" className={cn('relative shrink-0', className)}>
        <button
          ref={buttonRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setOpen(!isOpen)
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1',
            'text-xs font-medium tabular-nums transition-colors',
            theme.bgCardMuted,
            theme.border,
            theme.text,
            'hover:border-accent focus:border-tertiary focus:outline-none',
            isOpen && 'border-tertiary',
          )}
          aria-label="שעה"
          aria-expanded={isOpen}
        >
          <Clock size={12} className="shrink-0 text-muted" strokeWidth={2} />
          <span>{formatTimeOfDay(value.hour, selectedMinute)}</span>
        </button>
      </div>
      {panel && createPortal(panel, document.body)}
    </>
  )
}
