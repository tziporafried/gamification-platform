import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPanelLeftAlignedToTriggerRight, positionFloatingPanel } from '@/lib/floatingPanel'
import { DropdownHeader } from '@/components/ui/DropdownPanel'
import { theme } from '@/lib/theme'
import {
  REWARD_SCOPE_OPTIONS,
  getRewardScopeOptionLabel,
  rewardFieldsToScope,
  rewardScopeToFields,
  type RewardScopeId,
  type RewardTargetType,
  type RewardWinnerMode,
} from '@/lib/rewardTargeting'

const VIEWPORT_PADDING = 8
const PANEL_WIDTH = 260
const PANEL_GAP = 4
const PANEL_EST_HEIGHT = 220

const ACTIVE_OPTION_CLASS =
  'bg-[color-mix(in_srgb,var(--color-border)_55%,var(--color-surface-elevated))] font-semibold text-foreground ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-tertiary)_45%,var(--color-border))]'

function optionButtonClass(active: boolean) {
  return cn(
    'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-start transition-colors',
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

interface RewardScopeSelectProps {
  targetType: RewardTargetType
  winnerMode: RewardWinnerMode
  groupCount: number
  onChange: (scope: RewardScopeId) => void
  tone?: 'default' | 'onColor'
}

export function RewardScopeSelect({
  targetType,
  winnerMode,
  groupCount,
  onChange,
  tone = 'onColor',
}: RewardScopeSelectProps) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const scope = rewardFieldsToScope(targetType, winnerMode)
  const options = REWARD_SCOPE_OPTIONS.filter((option) => !option.requiresGroups || groupCount > 0)

  const chipLabel = getRewardScopeOptionLabel(scope)

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    const panel = panelRef.current
    if (!rect) return

    const width = panel?.offsetWidth || PANEL_WIDTH
    const height = panel?.offsetHeight || PANEL_EST_HEIGHT

    const { top, left } = positionFloatingPanel(
      rect,
      { width, height },
      { gap: PANEL_GAP, viewportPadding: VIEWPORT_PADDING },
    )
    setPanelStyle({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null)
      return
    }
    updatePosition()
    const frame = requestAnimationFrame(() => updatePosition())
    return () => cancelAnimationFrame(frame)
  }, [open, updatePosition, options.length])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
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
  }, [open, updatePosition])

  return (
    <div className="relative flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
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
              })
            }
            return next
          })
        }}
        title="מי יכול לזכות בפרס?"
        className={cn(
          theme.wizardCompactChip,
          tone === 'onColor'
            ? 'border-white/40 text-white bg-white/15 hover:bg-white/25'
            : 'border-border text-foreground bg-surface-elevated hover:bg-surface',
        )}
      >
        <span className="min-w-0 max-w-[140px] truncate">{chipLabel}</span>
        <ChevronDown className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: panelStyle?.top ?? -9999,
            left: panelStyle?.left ?? 0,
            width: 260,
            visibility: panelStyle ? 'visible' : 'hidden',
          }}
          className="z-[100] rounded-xl border border-border bg-surface shadow-dropdown py-1 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <DropdownHeader>מי יכול לזכות בפרס?</DropdownHeader>
          {options.map((option) => {
            const active = option.value === scope
            return (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={optionButtonClass(active)}
              >
                <span className="flex w-full items-center gap-2 text-xs font-medium">
                  <OptionCheck active={active} />
                  {option.label}
                </span>
                <span className="ps-5 text-[10px] leading-snug text-muted">{option.description}</span>
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

export { rewardScopeToFields, rewardFieldsToScope, type RewardScopeId }
