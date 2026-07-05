import { useState, useRef, useCallback, useLayoutEffect, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPanelLeftAlignedToTriggerRight } from '@/lib/floatingPanel'
import type { Group } from '@/types'
import { theme } from '@/lib/theme'

interface GroupSelectDropdownProps {
  groups: Group[]
  selectedGroupIds: Set<string>
  allGroupsLabel?: string
  emptyLabel?: string
  tooltip?: string
  isAllSelected: boolean
  onSelectAll: () => void
  onToggleGroup: (groupId: string, isMember: boolean) => void
  tone?: 'default' | 'onColor'
  size?: 'default' | 'compact' | 'badge'
  badgeMaxWidth?: number
}

const PANEL_WIDTH = 192
export const WIZARD_GROUP_CHIP_MAX_WIDTH = 140
const VIEWPORT_PADDING = 8

export function GroupSelectDropdown({
  groups,
  selectedGroupIds,
  allGroupsLabel = 'כל הקבוצות',
  emptyLabel,
  tooltip = 'לאילו קבוצות שייך הפריט',
  isAllSelected,
  onSelectAll,
  onToggleGroup,
  tone = 'default',
  size = 'default',
  badgeMaxWidth,
}: GroupSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setPanelStyle({
      top: rect.bottom + 4,
      left: getPanelLeftAlignedToTriggerRight(rect.right, PANEL_WIDTH, VIEWPORT_PADDING),
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

  const selectedGroups = groups.filter((g) => selectedGroupIds.has(g.id))

  let label: string
  if (isAllSelected) {
    label = allGroupsLabel
  } else if (selectedGroups.length === 0) {
    label = emptyLabel ?? allGroupsLabel
  } else if (selectedGroups.length === 1) {
    label = selectedGroups[0].name
  } else {
    label = `${selectedGroups.length} קבוצות`
  }

  const isWizardChip = size === 'compact' || size === 'badge'
  const compact = isWizardChip
  const isEmpty = !isAllSelected && selectedGroups.length === 0 && Boolean(emptyLabel)
  const singleGroupColor = selectedGroups.length === 1 && !isAllSelected && tone === 'default'
    ? selectedGroups[0].color
    : null

  const chipMaxWidth = badgeMaxWidth ?? (isWizardChip ? WIZARD_GROUP_CHIP_MAX_WIDTH : undefined)

  const badgeStyle: CSSProperties | undefined = chipMaxWidth || singleGroupColor
    ? {
        ...(chipMaxWidth ? { maxWidth: chipMaxWidth } : {}),
        ...(singleGroupColor
          ? {
              borderColor: singleGroupColor,
              backgroundColor: `color-mix(in srgb, ${singleGroupColor} 18%, transparent)`,
            }
          : {}),
      }
    : undefined

  return (
    <div className="relative flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        title={tooltip}
        style={badgeStyle}
        className={cn(
          compact ? theme.wizardCompactChip : 'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all',
          tone === 'onColor'
            ? isAllSelected
              ? 'border-white/50 text-white bg-white/20 hover:bg-white/30'
              : selectedGroups.length > 0
                ? 'border-white/40 text-white bg-white/15 hover:bg-white/25'
                : 'border-white/30 text-white/80 bg-white/10 hover:bg-white/20'
            : isEmpty
              ? 'border-border/50 text-muted/75 bg-black/[0.03] hover:bg-black/[0.05] hover:border-border'
              : singleGroupColor
                ? 'text-foreground hover:brightness-95'
                : isAllSelected
                  ? 'border-success text-success bg-surface-elevated hover:bg-surface'
                  : selectedGroups.length > 0
                    ? 'border-primary/30 text-foreground bg-surface-elevated hover:bg-surface hover:border-accent'
                    : 'border-border text-muted bg-surface-elevated hover:bg-surface hover:border-accent',
        )}
      >
        {!isAllSelected && selectedGroups.length > 1 && (
          <span className="flex -space-x-1 shrink-0">
            {selectedGroups.slice(0, 3).map((g) => (
              <span
                key={g.id}
                className={cn('h-2 w-2 rounded-full ring-1', tone === 'onColor' ? 'ring-white/40' : 'ring-surface')}
                style={{ backgroundColor: g.color }}
              />
            ))}
          </span>
        )}
        <span className={cn('min-w-0', tone === 'onColor' ? 'whitespace-nowrap' : 'truncate')}>{label}</span>
        <ChevronDown
          size={compact ? undefined : 12}
          className={cn('shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && panelStyle && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: panelStyle.top, left: panelStyle.left, width: PANEL_WIDTH }}
          className="z-[100] rounded-xl border border-border bg-surface shadow-dropdown py-1 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="px-3 py-1.5 text-[10px] text-muted">{tooltip}</div>
          <button
            onClick={() => { onSelectAll(); setOpen(false) }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-elevated',
              isAllSelected ? 'text-success' : 'text-muted',
            )}
          >
            <span className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
              isAllSelected ? 'border-success bg-success' : 'border-border',
            )}>
              {isAllSelected && <Check size={10} className="text-foreground" />}
            </span>
            {allGroupsLabel}
          </button>

          <div className="mx-2 my-1 border-t border-border" />

          {groups.map((g) => {
            const isMember = selectedGroupIds.has(g.id)
            return (
              <button
                key={g.id}
                onClick={() => onToggleGroup(g.id, isMember)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-surface-elevated',
                  isMember ? 'text-foreground' : 'text-muted',
                )}
              >
                <span className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  isMember ? 'border-transparent' : 'border-border',
                )} style={isMember ? { backgroundColor: g.color } : undefined}>
                  {isMember && <Check size={10} className="text-foreground" />}
                </span>
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: g.color }}
                />
                {g.name}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
