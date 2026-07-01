import { useState, useRef, useCallback } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/useClickOutside'
import type { Group } from '@/types'

interface GroupSelectDropdownProps {
  groups: Group[]
  selectedGroupIds: Set<string>
  allGroupsLabel?: string
  tooltip?: string
  isAllSelected: boolean
  onSelectAll: () => void
  onToggleGroup: (groupId: string, isMember: boolean) => void
}

export function GroupSelectDropdown({
  groups,
  selectedGroupIds,
  allGroupsLabel = 'כל הקבוצות',
  tooltip = 'לאילו קבוצות שייך הפריט',
  isAllSelected,
  onSelectAll,
  onToggleGroup,
}: GroupSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closeDropdown = useCallback(() => setOpen(false), [])
  useClickOutside(ref, closeDropdown)

  const selectedGroups = groups.filter((g) => selectedGroupIds.has(g.id))

  let label: string
  if (isAllSelected) {
    label = allGroupsLabel
  } else if (selectedGroups.length === 0) {
    label = allGroupsLabel
  } else if (selectedGroups.length === 1) {
    label = selectedGroups[0].name
  } else {
    label = `${selectedGroups.length} קבוצות`
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        title={tooltip}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all border',
          isAllSelected
            ? 'border-success text-success bg-surface-elevated hover:bg-surface'
            : selectedGroups.length > 0
              ? 'border-primary/30 text-foreground bg-surface-elevated hover:bg-surface'
              : 'border-border text-muted bg-surface-elevated hover:bg-surface',
        )}
      >
        {!isAllSelected && selectedGroups.length > 0 && (
          <span className="flex -space-x-1">
            {selectedGroups.slice(0, 3).map((g) => (
              <span
                key={g.id}
                className="h-2 w-2 rounded-full ring-1 ring-surface"
                style={{ backgroundColor: g.color }}
              />
            ))}
          </span>
        )}
        {label}
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 right-0 w-48 rounded-xl border border-border bg-surface shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150">
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
        </div>
      )}
    </div>
  )
}
