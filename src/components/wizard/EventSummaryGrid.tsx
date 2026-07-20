import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Users, CheckSquare, ScanLine, QrCode, Star, Gift } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  AnimatedSummaryCard,
  getSummaryCardVariantStyles,
  type SummaryCardVariant,
} from './ReadyCelebration'
import type { EventCounts, ControlCenterLiveStats } from '@/types'

type SummaryCardType = SummaryCardVariant

export interface SummaryItem {
  type: SummaryCardType
  value: number
}

interface EventSummaryGridProps {
  counts: EventCounts
  isTemplate?: boolean
  ready: boolean
  animationKey?: number
  showCards?: boolean
  showScans?: boolean
  totalCards?: number
  compact?: boolean
  rotating?: boolean
  rotateIntervalMs?: number
}

export function getEventSummaryItems(
  counts: EventCounts,
  {
    isTemplate = false,
    showScans = false,
    showCards = false,
    totalCards = 0,
  }: {
    isTemplate?: boolean
    showScans?: boolean
    showCards?: boolean
    totalCards?: number
  } = {},
): SummaryItem[] {
  const withCards = showCards && !isTemplate
  const items: SummaryItem[] = []

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

  return items
}

export function getControlCenterSummaryItems(
  stats: ControlCenterLiveStats,
  { showActiveGroups = false, hasRewards = false }: { showActiveGroups?: boolean; hasRewards?: boolean } = {},
): SummaryItem[] {
  const items: SummaryItem[] = [
    { type: 'participants', value: stats.playersPlayed },
  ]

  if (showActiveGroups) {
    items.push({ type: 'groups', value: stats.activeGroups })
  }

  items.push(
    { type: 'activities', value: stats.activityTypesScanned },
    { type: 'scans', value: stats.totalScans },
    { type: 'points', value: stats.totalPoints },
  )

  if (hasRewards) {
    items.push({ type: 'rewardsEarned', value: stats.rewardsEarned })
  }

  return items
}

export function LiveStatsCaption({
  items,
  ready,
  intervalMs,
  enabled = true,
}: {
  items: SummaryItem[]
  ready: boolean
  intervalMs: number
  enabled?: boolean
}) {
  const reducedMotion = usePrefersReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [tickInterval] = useState(() =>
    Math.max(2200, intervalMs + Math.floor(Math.random() * 600) - 300),
  )

  useEffect(() => {
    if (!enabled || items.length <= 1 || reducedMotion) return
    const timer = setInterval(() => {
      setActiveIndex((index) => (index + 1) % items.length)
    }, tickInterval)
    return () => clearInterval(timer)
  }, [enabled, items.length, tickInterval, reducedMotion])

  if (!enabled || items.length === 0) return null

  const activeItem = items[activeIndex] ?? items[0]

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-4">
      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeItem.type}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <SummaryCard
              type={activeItem.type}
              value={activeItem.value}
              index={0}
              ready={ready}
              animationKey={0}
              skipEntrance
              toast
              live
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  )
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    function onChange(e: MediaQueryListEvent) {
      setReduced(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
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
  rotating = false,
  rotateIntervalMs = 3000,
}: EventSummaryGridProps) {
  const reducedMotion = usePrefersReducedMotion()
  const items = getEventSummaryItems(counts, { isTemplate, showScans, showCards, totalCards })

  if (rotating && items.length > 1 && !reducedMotion) {
    return (
      <RotatingSummaryCards
        items={items}
        ready={ready}
        animationKey={animationKey}
        compact={compact}
        intervalMs={rotateIntervalMs}
      />
    )
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

function RotatingSummaryCards({
  items,
  ready,
  animationKey,
  compact,
  intervalMs,
}: {
  items: SummaryItem[]
  ready: boolean
  animationKey: number
  compact: boolean
  intervalMs: number
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [tickInterval] = useState(() => intervalMs)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((index) => (index + 1) % items.length)
    }, tickInterval)
    return () => clearInterval(timer)
  }, [items.length, tickInterval])

  const activeItem = items[activeIndex]

  return (
    <div className="relative min-h-[8.5rem] overflow-visible">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${animationKey}-${activeItem.type}`}
          className="w-full"
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.96 }}
          transition={{ duration: 0.38, ease: 'easeInOut' }}
        >
          <SummaryCard
            type={activeItem.type}
            value={activeItem.value}
            index={0}
            ready={ready}
            animationKey={animationKey}
            compact={compact}
            skipEntrance
            featured
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function formatSummaryLabel(type: SummaryCardType, value: number, live = false): string {
  switch (type) {
    case 'participants':
      if (live) {
        if (value === 0) return 'עדיין אין משתתפים פעילים'
        return value === 1 ? '1 משתתף פעיל' : `${value.toLocaleString('he-IL')} משתתפים פעילים`
      }
      return value === 1 ? '1 משתתף' : `${value} משתתפים`
    case 'activities':
      if (live) {
        if (value === 0) return 'עדיין לא נסרקו סוגי פעילות'
        return value === 1 ? '1 סוג פעילות נסרק' : `${value.toLocaleString('he-IL')} סוגי פעילות נסרקו`
      }
      return value === 1 ? '1 פעילות' : `${value} פעילויות`
    case 'groups':
      if (live) {
        if (value === 0) return 'עדיין אין קבוצות פעילות'
        return value === 1 ? '1 קבוצה פעילה' : `${value.toLocaleString('he-IL')} קבוצות פעילות`
      }
      return value === 1 ? '1 קבוצה' : `${value} קבוצות`
    case 'groupsTogether':
      return 'כולם יחד'
    case 'scans':
      if (live) {
        if (value === 0) return 'עדיין לא היו סריקות'
        return value === 1 ? '1 סריקה' : `${value.toLocaleString('he-IL')} סריקות`
      }
      return value === 1 ? '1 סריקה' : `${value} סריקות`
    case 'points':
      if (live) {
        if (value === 0) return 'עדיין לא נצברו נקודות'
        return value === 1 ? '1 נקודה נצברה' : `${value.toLocaleString('he-IL')} נקודות נצברו`
      }
      return value === 1 ? '1 נקודה' : `${value.toLocaleString('he-IL')} נקודות`
    case 'rewardsEarned':
      if (live) {
        if (value === 0) return 'עדיין לא נצברו פרסים'
        return value === 1 ? '1 פרס נצבר' : `${value.toLocaleString('he-IL')} פרסים נצברו`
      }
      return value === 1 ? '1 פרס' : `${value.toLocaleString('he-IL')} פרסים`
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
    case 'points':
      return Star
    case 'rewardsEarned':
      return Gift
    case 'cards':
      return QrCode
  }
}

function formatSummaryTitle(type: SummaryCardType): string {
  switch (type) {
    case 'participants':
      return 'משתתפים'
    case 'activities':
      return 'פעילויות'
    case 'groups':
      return 'קבוצות'
    case 'groupsTogether':
      return 'כולם יחד'
    case 'scans':
      return 'סריקות'
    case 'points':
      return 'נקודות'
    case 'rewardsEarned':
      return 'פרסים'
    case 'cards':
      return 'כרטיסים'
  }
}

function getSummaryAccent(type: SummaryCardType): { iconBg: string; iconText: string } {
  switch (type) {
    case 'participants':
      return {
        iconBg: 'bg-primary/12',
        iconText: 'text-primary-text',
      }
    case 'activities':
      return {
        iconBg: 'bg-secondary/12',
        iconText: 'text-secondary-text',
      }
    case 'groups':
    case 'groupsTogether':
      return {
        iconBg: 'bg-tertiary/12',
        iconText: 'text-tertiary-text',
      }
    case 'scans':
      return {
        iconBg: 'bg-success/12',
        iconText: 'text-success-text',
      }
    case 'points':
      return {
        iconBg: 'bg-primary/12',
        iconText: 'text-primary-text',
      }
    case 'rewardsEarned':
      return {
        iconBg: 'bg-warning/12',
        iconText: 'text-warning-text',
      }
    case 'cards':
      return {
        iconBg: 'bg-warning/12',
        iconText: 'text-warning-text',
      }
  }
}

function SummaryCard({
  type,
  value,
  index,
  ready,
  animationKey,
  compact = false,
  skipEntrance = false,
  featured = false,
  ticker = false,
  caption = false,
  toast = false,
  live = false,
}: {
  type: SummaryCardType
  value: number
  index: number
  ready: boolean
  animationKey: number
  compact?: boolean
  skipEntrance?: boolean
  featured?: boolean
  ticker?: boolean
  caption?: boolean
  toast?: boolean
  live?: boolean
}) {
  const label = formatSummaryLabel(type, value, live)
  const title = formatSummaryTitle(type)
  const variantStyles = getSummaryCardVariantStyles(type)
  const accent = getSummaryAccent(type)
  const Icon = getSummaryIcon(type)
  const iconSize = featured ? 28 : toast ? 17 : caption ? 26 : ticker ? 18 : compact ? 12 : 14

  if (toast) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-center justify-center gap-2',
          'rounded-lg border border-border/30 bg-white/35 px-3 py-1.5',
          'shadow-[0_4px_18px_rgba(46,34,30,0.06)] backdrop-blur-md',
        )}
      >
        <Icon
          size={13}
          strokeWidth={2}
          className={cn('shrink-0 opacity-80', accent.iconText)}
          aria-hidden="true"
        />
        <span className="text-xs font-medium leading-snug text-foreground/75">{label}</span>
      </div>
    )
  }

  if (caption || ticker) {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center shadow-card',
          caption
            ? 'min-h-16 gap-3.5 rounded-2xl px-8 py-4'
            : 'h-9 gap-2 rounded-lg px-4',
          ready ? variantStyles.cardHighlight : variantStyles.card,
        )}
      >
        <Icon
          size={iconSize}
          strokeWidth={2.25}
          className={cn('shrink-0 opacity-90', variantStyles.text)}
          aria-hidden="true"
        />
        <span
          className={cn(
            'font-bold leading-tight',
            caption ? 'text-2xl font-black sm:text-[1.65rem]' : 'text-lg leading-none',
            variantStyles.text,
          )}
        >
          {label}
        </span>
      </div>
    )
  }

  if (featured) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-neutral-400 bg-surface-elevated px-8 py-7 shadow-card',
        )}
      >
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl',
            accent.iconBg,
          )}
        >
          <Icon size={iconSize} strokeWidth={2.25} className={cn('shrink-0', accent.iconText)} aria-hidden="true" />
        </div>
        <div className="text-center">
          <p className="text-4xl font-black tabular-nums text-foreground sm:text-5xl">
            {value.toLocaleString('he-IL')}
          </p>
          <p className="mt-1 text-base font-bold text-muted">{title}</p>
        </div>
      </div>
    )
  }

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

  if (!ready || compact || skipEntrance) {
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
