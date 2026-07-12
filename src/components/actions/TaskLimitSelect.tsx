import { useState, useRef, useCallback, useLayoutEffect, useEffect, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Repeat, RotateCcw, Hash, ChevronDown, CalendarDays, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPanelLeftAlignedToTriggerRight } from '@/lib/floatingPanel'
import { DropdownDivider, DropdownHeader } from '@/components/ui/DropdownPanel'
import { AppTimePicker } from '@/components/ui/AppTimePicker'
import { ChipButton } from '@/components/ui/ChipButton'
import { theme } from '@/lib/theme'
import { formatTimeRange } from '@/lib/israelTime'
import {
  getEditorTimeDraft,
  getLimitLabel,
  hasDailyTimeWindow,
  isDailyTimeWindowValid,
  type DailyTimeWindow,
  type LimitMode,
  type TimeOfDay,
} from '@/lib/taskLimit'

interface TaskLimitSelectProps {
  limitMode: LimitMode
  customLimit: number
  dailyWindow: DailyTimeWindow
  editingLimit: boolean
  limitRef: React.RefObject<HTMLInputElement>
  onSaveLimitMode: (mode: LimitMode, options?: { limit?: number; dailyWindow?: DailyTimeWindow }) => void
  onSetEditingLimit: (v: boolean) => void
  onSetCustomLimit: (v: number) => void
  onResetLimit: () => void
  tone?: 'default' | 'onColor'
  size?: 'default' | 'compact'
}

const PANEL_WIDTH = 272
const PANEL_GAP = 4
const PANEL_EST_HEIGHT = 320
const VIEWPORT_PADDING = 8

type DailyTimeMode = 'anytime' | 'between'

const ACTIVE_OPTION_CLASS =
  'bg-[color-mix(in_srgb,var(--color-border)_55%,var(--color-surface-elevated))] font-semibold text-foreground ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-tertiary)_45%,var(--color-border))]'

function optionButtonClass(active: boolean) {
  return cn(
    'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors',
    active
      ? ACTIVE_OPTION_CLASS
      : 'text-muted hover:bg-surface-elevated hover:text-foreground',
  )
}

function OptionCheck({ active }: { active: boolean }) {
  if (!active) return <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
  return (
    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-tertiary text-white">
      <Check size={9} strokeWidth={3} aria-hidden />
    </span>
  )
}

export function TaskLimitSelect({
  limitMode,
  customLimit,
  dailyWindow,
  editingLimit,
  limitRef,
  onSaveLimitMode,
  onSetEditingLimit,
  onSetCustomLimit,
  onResetLimit,
  tone = 'default',
  size = 'compact',
}: TaskLimitSelectProps) {
  const [open, setOpen] = useState(false)
  const [editingDailyHour, setEditingDailyHour] = useState(false)
  const [dailyTimeMode, setDailyTimeMode] = useState<DailyTimeMode>('anytime')
  const [openTimeField, setOpenTimeField] = useState<'start' | 'end' | null>(null)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; maxHeight: number } | null>(null)
  const [draftStart, setDraftStart] = useState<TimeOfDay>(() => getEditorTimeDraft(dailyWindow).start)
  const [draftEnd, setDraftEnd] = useState<TimeOfDay>(() => getEditorTimeDraft(dailyWindow).end)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const draftStartRef = useRef(draftStart)
  const draftEndRef = useRef(draftEnd)
  const dailyTimeModeRef = useRef(dailyTimeMode)

  draftStartRef.current = draftStart
  draftEndRef.current = draftEnd
  dailyTimeModeRef.current = dailyTimeMode

  const limitTooltip = 'כמה סריקות כל משתתף יכול לבצע'
  const label = getLimitLabel(limitMode, customLimit, dailyWindow)
  const draftWindow: DailyTimeWindow = { start: draftStart, end: draftEnd }
  const timeWindowValid = isDailyTimeWindowValid(draftWindow)

  const Icon = limitMode === 'unlimited' ? Repeat
    : limitMode === 'once' ? RotateCcw
    : limitMode === 'daily' ? CalendarDays
    : Hash
  const compact = size === 'compact'

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    const panel = panelRef.current
    if (!rect) return

    const panelWidth = panel?.offsetWidth ?? PANEL_WIDTH
    const panelHeight = panel?.offsetHeight ?? PANEL_EST_HEIGHT
    const maxHeight = window.innerHeight - VIEWPORT_PADDING * 2
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING
    const spaceAbove = rect.top - VIEWPORT_PADDING
    const openUp = panelHeight > spaceBelow && spaceAbove > spaceBelow

    let top = openUp
      ? rect.top - panelHeight - PANEL_GAP
      : rect.bottom + PANEL_GAP

    top = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - Math.min(panelHeight, maxHeight) - VIEWPORT_PADDING))

    setPanelStyle({
      top,
      left: getPanelLeftAlignedToTriggerRight(rect.right, panelWidth, VIEWPORT_PADDING),
      maxHeight,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null)
      return
    }
    updatePosition()
    const frame = requestAnimationFrame(() => updatePosition())
    return () => cancelAnimationFrame(frame)
  }, [open, updatePosition, editingDailyHour, editingLimit, dailyTimeMode])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      if (dailyTimeModeRef.current === 'between') {
        const window: DailyTimeWindow = {
          start: draftStartRef.current,
          end: draftEndRef.current,
        }
        if (isDailyTimeWindowValid(window)) {
          onSaveLimitMode('daily', { dailyWindow: window })
        }
      }
      setOpen(false)
      onSetEditingLimit(false)
      setEditingDailyHour(false)
      setOpenTimeField(null)
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
  }, [open, updatePosition, onSetEditingLimit, onSaveLimitMode])

  useEffect(() => {
    if (!open) return
    if (limitMode === 'daily') {
      const draft = getEditorTimeDraft(dailyWindow)
      setEditingDailyHour(true)
      setDailyTimeMode(hasDailyTimeWindow(dailyWindow) ? 'between' : 'anytime')
      setDraftStart(draft.start)
      setDraftEnd(draft.end)
    } else {
      setEditingDailyHour(false)
    }
    onSetEditingLimit(limitMode === 'limited')
  }, [open, limitMode, onSetEditingLimit])

  function persistDailyWindow(window: DailyTimeWindow) {
    if (!isDailyTimeWindowValid(window)) return
    onSaveLimitMode('daily', { dailyWindow: window })
  }

  function persistDraftRange(
    start: TimeOfDay = draftStart,
    end: TimeOfDay = draftEnd,
    mode: DailyTimeMode = dailyTimeMode,
  ) {
    if (mode !== 'between') return
    persistDailyWindow({ start, end })
  }

  function flushDailyDraft() {
    persistDraftRange()
  }

  function close() {
    flushDailyDraft()
    setOpen(false)
    onSetEditingLimit(false)
    setEditingDailyHour(false)
    setOpenTimeField(null)
  }

  function updateDraftStart(next: TimeOfDay) {
    setDraftStart(next)
    persistDraftRange(next, draftEnd)
  }

  function updateDraftEnd(next: TimeOfDay) {
    setDraftEnd(next)
    persistDraftRange(draftStart, next)
  }

  function setDailyTimeModeAndPersist(mode: DailyTimeMode) {
    setDailyTimeMode(mode)
    setOpenTimeField(null)
    if (mode === 'anytime') {
      onSaveLimitMode('daily', { dailyWindow: { start: null, end: null } })
      return
    }
    const editorDraft = getEditorTimeDraft(dailyWindow)
    const window: DailyTimeWindow = { start: editorDraft.start, end: editorDraft.end }
    setDraftStart(editorDraft.start)
    setDraftEnd(editorDraft.end)
    persistDailyWindow(window)
  }

  function openDailyEditor(e: { preventDefault(): void; stopPropagation(): void }) {
    e.preventDefault()
    e.stopPropagation()

    if (editingDailyHour) return

    const editorDraft = getEditorTimeDraft(dailyWindow)

    setEditingDailyHour(true)
    setDailyTimeMode(hasDailyTimeWindow(dailyWindow) ? 'between' : 'anytime')
    setDraftStart(editorDraft.start)
    setDraftEnd(editorDraft.end)

    if (limitMode !== 'daily') {
      onSaveLimitMode('daily', { dailyWindow: { start: null, end: null } })
    }
  }

  function handleDraftKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter') { e.preventDefault(); persistDraftRange() }
    if (e.key === 'Escape') { close(); onResetLimit() }
  }

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev
      if (!next) {
        setPanelStyle(null)
        return next
      }
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) {
        setPanelStyle({
          top: rect.bottom + PANEL_GAP,
          left: getPanelLeftAlignedToTriggerRight(rect.right, PANEL_WIDTH, VIEWPORT_PADDING),
          maxHeight: window.innerHeight - VIEWPORT_PADDING * 2,
        })
      }
      return next
    })
  }

  return (
    <div className="relative flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
      {tone === 'onColor' ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
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
          onClick={toggleOpen}
          title={limitTooltip}
          className="max-w-[14rem]"
        >
          <Icon size={10} className="shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
        </ChipButton>
      )}

      {open && createPortal(
        <div
          ref={panelRef}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: panelStyle?.top ?? -9999,
            left: panelStyle?.left ?? getPanelLeftAlignedToTriggerRight(0, PANEL_WIDTH, VIEWPORT_PADDING),
            width: PANEL_WIDTH,
            maxHeight: panelStyle?.maxHeight,
            visibility: panelStyle ? 'visible' : 'hidden',
          }}
          className={cn(
            'z-[100] overflow-y-auto overscroll-contain rounded-xl border py-1 shadow-podium',
            panelStyle && 'animate-[fade-in_150ms_ease-out,slide-down_150ms_ease-out]',
            theme.bgCard,
            theme.border,
          )}
        >
          <DropdownHeader>כמה סריקות כל משתתף יכול לבצע</DropdownHeader>
          <button
            type="button"
            onClick={() => { onSaveLimitMode('unlimited'); close() }}
            className={optionButtonClass(limitMode === 'unlimited')}
          >
            <Repeat size={12} className="shrink-0" />
            <div className="flex-1 text-right">
              <div>ניתן לבצע ללא הגבלה</div>
              <div className="text-[10px] font-normal text-muted">ניתן לבצע כמה סריקות שרוצים</div>
            </div>
            <OptionCheck active={limitMode === 'unlimited'} />
          </button>
          <DropdownDivider />
          <button
            type="button"
            onClick={() => { onSaveLimitMode('once'); close() }}
            className={optionButtonClass(limitMode === 'once')}
          >
            <RotateCcw size={12} className="shrink-0" />
            <div className="flex-1 text-right">
              <div>פעם אחת</div>
              <div className="text-[10px] font-normal text-muted">כל משתתף יכול לבצע פעם אחת בלבד</div>
            </div>
            <OptionCheck active={limitMode === 'once'} />
          </button>
          <DropdownDivider />
          {editingDailyHour ? (
            <div
              className={cn(
                'space-y-2 px-3 py-2',
                limitMode === 'daily' && cn('mx-1 rounded-lg', ACTIVE_OPTION_CLASS),
              )}
              dir="rtl"
            >
              <div className="flex w-full items-center gap-2">
                <CalendarDays size={12} className="shrink-0 text-muted" />
                <div className="flex-1 text-xs font-medium text-foreground">פעם ביום</div>
                <OptionCheck active={limitMode === 'daily'} />
              </div>
              <div className={cn('flex w-full rounded-lg border p-0.5', theme.border, theme.bgCardMuted)}>
                <button
                  type="button"
                  onClick={() => setDailyTimeModeAndPersist('anytime')}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                    dailyTimeMode === 'anytime'
                      ? 'bg-surface text-foreground shadow-sm'
                      : 'text-muted hover:text-foreground',
                  )}
                >
                  ללא הגבלות שעות
                </button>
                <button
                  type="button"
                  onClick={() => setDailyTimeModeAndPersist('between')}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                    dailyTimeMode === 'between'
                      ? 'bg-surface text-foreground shadow-sm'
                      : 'text-muted hover:text-foreground',
                  )}
                >
                  בין השעות
                </button>
              </div>
              {dailyTimeMode === 'between' && (
                <>
                  <div className="flex w-full items-center justify-start gap-2">
                    <AppTimePicker
                      value={draftStart}
                      open={openTimeField === 'start'}
                      onOpenChange={(next) => setOpenTimeField(next ? 'start' : null)}
                      onChange={updateDraftStart}
                      onBlur={persistDraftRange}
                      onKeyDown={handleDraftKeyDown}
                    />
                    <span className="shrink-0 text-xs text-muted">עד</span>
                    <AppTimePicker
                      value={draftEnd}
                      open={openTimeField === 'end'}
                      onOpenChange={(next) => setOpenTimeField(next ? 'end' : null)}
                      onChange={updateDraftEnd}
                      onBlur={persistDraftRange}
                      onKeyDown={handleDraftKeyDown}
                    />
                  </div>
                  {!timeWindowValid && (
                    <div className="text-[10px] text-warning">שעת ההתחלה חייבת להיות לפני הסיום</div>
                  )}
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openDailyEditor}
              className={optionButtonClass(limitMode === 'daily')}
            >
              <CalendarDays size={12} className="shrink-0" />
              <div className="flex-1 text-right">
                <div>
                  {limitMode === 'daily' && hasDailyTimeWindow(dailyWindow)
                    ? `פעם ביום ${formatTimeRange(
                        dailyWindow.start!.hour,
                        dailyWindow.start!.minute,
                        dailyWindow.end!.hour,
                        dailyWindow.end!.minute,
                      )}`
                    : 'פעם ביום'}
                </div>
                <div className="text-[10px] font-normal text-muted">
                  {limitMode === 'daily'
                    ? 'לחץ להגדרת טווח שעות (אופציונלי)'
                    : 'פעם אחת בכל יום'}
                </div>
              </div>
              <OptionCheck active={limitMode === 'daily'} />
            </button>
          )}
          <DropdownDivider />
          {editingLimit ? (
            <div
              className={cn(
                'space-y-2 px-3 py-2',
                limitMode === 'limited' && cn('mx-1 rounded-lg', ACTIVE_OPTION_CLASS),
              )}
              dir="rtl"
            >
              <div className="flex w-full items-center gap-2">
                <Hash size={12} className="shrink-0 text-muted" />
                <div className="flex-1 text-xs font-medium text-foreground">מוגבל</div>
                <OptionCheck active={limitMode === 'limited'} />
              </div>
              <div className="flex w-full items-center justify-start gap-1.5">
                <span className="shrink-0 text-xs text-muted">מוגבל לעד</span>
                <input
                  ref={limitRef}
                  type="number"
                  min={2}
                  value={customLimit}
                  onChange={(e) => onSetCustomLimit(Math.max(2, parseInt(e.target.value, 10) || 2))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); onSaveLimitMode('limited', { limit: Math.max(2, customLimit) }); close() }
                    if (e.key === 'Escape') { close(); onResetLimit() }
                  }}
                  onBlur={() => { onSaveLimitMode('limited', { limit: Math.max(2, customLimit) }); onSetEditingLimit(false) }}
                  className="w-12 rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-xs text-center font-medium text-foreground outline-none focus:border-tertiary"
                  autoFocus
                />
                <span className="shrink-0 text-xs text-muted">סריקות</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { onSaveLimitMode('limited'); onSetEditingLimit(true) }}
              className={optionButtonClass(limitMode === 'limited')}
            >
              <Hash size={12} className="shrink-0" />
              <div className="flex-1 text-right">
                <div>{limitMode === 'limited' ? `${customLimit} סריקות` : 'מוגבל...'}</div>
                <div className="text-[10px] font-normal text-muted">הגדר מספר מירבי של סריקות</div>
              </div>
              <OptionCheck active={limitMode === 'limited'} />
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
