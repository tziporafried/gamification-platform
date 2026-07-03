import { cn } from '@/lib/utils'
import { Users, CheckSquare, ScanLine, QrCode } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  AnimatedSummaryCard,
  getSummaryCardVariantStyles,
  type SummaryCardVariant,
} from './ReadyCelebration'
import type { EventCounts } from '@/types'

type SummaryCardType = SummaryCardVariant

interface EventSummaryGridProps {
  counts: EventCounts
  isTemplate?: boolean
  ready: boolean
  animationKey?: number
  showCards?: boolean
  showScans?: boolean
  totalCards?: number
  compact?: boolean
}

export function EventSummaryGrid({
  counts,
  isTemplate = false,
  ready,
  animationKey = 0,
  showCards = false,
  showScans = false,
  totalCards = 0,
  compact = false,
}: EventSummaryGridProps) {
  const withCards = showCards && !isTemplate
  const items: { type: SummaryCardType; value: number }[] = []

  if (!isTemplate) {
    items.push({ type: 'participants', value: counts.participants })
  }
  items.push({ type: 'activities', value: counts.tasks })
  if (showScans) {
    items.push({ type: 'scans', value: counts.transactions })
  } else if (counts.groups > 0) {
    items.push({ type: 'groups', value: counts.groups })
  }
  if (withCards) {
    items.push({ type: 'cards', value: totalCards })
  }

  const columnClass =
    items.length >= 4 ? 'grid-cols-2 sm:grid-cols-4'
    : items.length === 3 ? 'grid-cols-3'
    : 'grid-cols-2'

  return (
    <div className={cn('grid gap-2 overflow-visible', columnClass, compact && 'gap-1.5')}>
      {items.map((item, index) => (
        <SummaryCard
          key={item.type}
          type={item.type}
          value={item.value}
          index={index}
          ready={ready}
          animationKey={animationKey}
          compact={compact}
        />
      ))}
    </div>
  )
}

function formatSummaryLabel(type: SummaryCardType, value: number): string {
  switch (type) {
    case 'participants':
      return value === 1 ? '1 משתתף' : `${value} משתתפים`
    case 'activities':
      return value === 1 ? '1 פעילות' : `${value} פעילויות`
    case 'groups':
      return value === 1 ? '1 קבוצה' : `${value} קבוצות`
    case 'groupsTogether':
      return 'כולם יחד'
    case 'scans':
      return value === 1 ? '1 סריקה' : `${value} סריקות`
    case 'cards':
      return value === 1 ? '1 כרטיס' : `${value} כרטיסים`
  }
}

function getSummaryIcon(type: SummaryCardType): LucideIcon {
  switch (type) {
    case 'participants':
    case 'groups':
    case 'groupsTogether':
      return Users
    case 'activities':
      return CheckSquare
    case 'scans':
      return ScanLine
    case 'cards':
      return QrCode
  }
}

function SummaryCard({
  type,
  value,
  index,
  ready,
  animationKey,
  compact = false,
}: {
  type: SummaryCardType
  value: number
  index: number
  ready: boolean
  animationKey: number
  compact?: boolean
}) {
  const label = formatSummaryLabel(type, value)
  const variantStyles = getSummaryCardVariantStyles(type)
  const Icon = getSummaryIcon(type)
  const iconSize = compact ? 12 : 14

  const content = (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-semibold',
      variantStyles.text,
      compact ? 'text-xs' : 'text-sm',
    )}>
      <Icon size={iconSize} strokeWidth={2.25} className="shrink-0 opacity-90" aria-hidden="true" />
      {label}
    </span>
  )

  const cardClass = cn(
    'rounded-xl flex items-center justify-center shadow-sm',
    compact ? 'px-2 py-1' : 'px-3 py-2',
    ready ? variantStyles.cardHighlight : variantStyles.card,
  )

  if (!ready || compact) {
    return (
      <div className={cardClass}>
        {content}
      </div>
    )
  }

  return (
    <AnimatedSummaryCard key={`${animationKey}-${index}`} index={index} variant={type} highlight={ready}>
      {content}
    </AnimatedSummaryCard>
  )
}
