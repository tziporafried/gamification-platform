import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import type { RankedGroup } from '@/hooks/useOperationsData'
import { cn } from '@/lib/utils'

interface Props {
  rankedGroups: RankedGroup[]
  titlePulse?: boolean
}

const MEDAL = ['🥇', '🥈', '🥉']

const CONFETTI_COLORS = [
  'var(--color-warning)',
  'var(--color-accent)',
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-secondary)',
  'var(--color-primary-hover)',
  'var(--color-danger)',
]

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-warning text-foreground'
  if (rank === 2) return 'bg-surface-elevated border border-border text-foreground'
  if (rank === 3) return 'bg-surface-elevated border border-accent text-foreground'
  return 'bg-secondary text-foreground'
}

function ConfettiBurst({ active }: { active: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: (i / 12) * 360,
      distance: 35 + Math.random() * 20,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 3 + Math.random() * 3,
      isCircle: i % 2 === 0,
    }))
  , [])

  return (
    <AnimatePresence>
      {active && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-start" style={{ paddingRight: 8 }}>
          {particles.map(p => {
            const rad = (p.angle * Math.PI) / 180
            const tx = Math.cos(rad) * p.distance
            const ty = Math.sin(rad) * p.distance
            return (
              <motion.div key={p.id}
                className="absolute"
                style={{
                  width: p.size, height: p.size,
                  backgroundColor: p.color,
                  borderRadius: p.isCircle ? '50%' : '1px',
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                animate={{ x: tx, y: ty, opacity: 0, scale: 1 }}
                transition={{ duration: 0.65, ease: 'easeOut' }} />
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}

export function OpsLeaderboard({ rankedGroups, titlePulse }: Props) {
  const prevRanksRef = useRef<Map<string, number>>(new Map())
  const [improvedGroups, setImprovedGroups] = useState<Set<string>>(new Set())
  const [newTop3Groups, setNewTop3Groups] = useState<Set<string>>(new Set())
  const [rank1Group, setRank1Group] = useState<string | null>(null)

  useEffect(() => {
    const prevRanks = prevRanksRef.current
    if (prevRanks.size === 0) {
      const m = new Map<string, number>()
      for (const g of rankedGroups) m.set(g.group_id, g.rank)
      prevRanksRef.current = m
      return
    }

    const improved = new Set<string>()
    const newTop3 = new Set<string>()
    let newRank1: string | null = null

    for (const g of rankedGroups) {
      const prev = prevRanks.get(g.group_id)
      if (prev !== undefined && g.rank < prev) {
        improved.add(g.group_id)
        if (g.rank <= 3 && prev > 3) newTop3.add(g.group_id)
        if (g.rank === 1 && prev > 1) newRank1 = g.group_id
      }
    }

    if (improved.size > 0) {
      setImprovedGroups(improved)
      setNewTop3Groups(newTop3)
      setRank1Group(newRank1)
      const timer = setTimeout(() => {
        setImprovedGroups(new Set())
        setNewTop3Groups(new Set())
        setRank1Group(null)
      }, 1100)
      return () => clearTimeout(timer)
    }

    const m = new Map<string, number>()
    for (const g of rankedGroups) m.set(g.group_id, g.rank)
    prevRanksRef.current = m
  }, [rankedGroups])

  useEffect(() => {
    const timer = setTimeout(() => {
      const m = new Map<string, number>()
      for (const g of rankedGroups) m.set(g.group_id, g.rank)
      prevRanksRef.current = m
    }, 50)
    return () => clearTimeout(timer)
  }, [rankedGroups])

  const maxPts = rankedGroups[0]?.total_points || 1

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        className="flex items-center gap-2"
        animate={titlePulse ? { y: [0, -3, 0] } : {}}
        transition={{ duration: 0.3 }}>
        <Trophy size={16} className="text-warning" />
        <span className="text-sm font-black text-foreground">דירוג קבוצות</span>
      </motion.div>

      {rankedGroups.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">אין נתוני קבוצות עדיין</p>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {rankedGroups.slice(0, 6).map(g => {
              const isImproved = improvedGroups.has(g.group_id)
              const isNewTop3 = newTop3Groups.has(g.group_id)
              const isRank1 = rank1Group === g.group_id
              const pct = Math.round((g.total_points / maxPts) * 100)
              const isTop3 = g.rank <= 3

              return (
                <motion.div
                  key={g.group_id}
                  layout
                  layoutId={`ops-lb-${g.group_id}`}
                  className={cn(
                    'relative overflow-hidden rounded-xl border bg-surface p-3',
                    isRank1 && 'border-warning bg-surface-elevated',
                    !isRank1 && isTop3 && 'border-border bg-surface-elevated',
                    !isTop3 && 'border-border',
                  )}
                  animate={isImproved ? {
                    backgroundColor: [
                      'color-mix(in srgb, var(--color-warning) 18%, var(--color-surface))',
                      'var(--color-surface)',
                    ],
                  } : {}}
                  transition={{
                    layout: { duration: 0.4, ease: 'easeInOut' },
                    backgroundColor: { duration: 0.9 },
                  }}>

                  <ConfettiBurst active={isNewTop3} />

                  <div className="relative flex items-center gap-2.5">
                    <div className="shrink-0 flex flex-col items-center">
                      {isTop3 ? (
                        <motion.span
                          className="text-xl leading-none"
                          animate={isImproved ? { scale: [1, 1.5, 1] } : {}}
                          transition={{ duration: 0.45 }}>
                          {MEDAL[g.rank - 1]}
                        </motion.span>
                      ) : (
                        <div className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black',
                          rankBadgeClass(g.rank),
                        )}>
                          {g.rank}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isRank1 && (
                            <motion.span
                              initial={{ scale: 0, rotate: -20 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', damping: 12 }}>
                              🏆
                            </motion.span>
                          )}
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: g.group_color }} />
                          <span className={cn('font-black text-foreground truncate', isTop3 ? 'text-sm' : 'text-xs')}>{g.group_name}</span>
                        </div>
                        <span className={cn('font-black text-foreground shrink-0 tabular-nums', isTop3 ? 'text-sm' : 'text-xs')}>
                          <AnimatedCounter value={g.total_points} duration={600} />
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-border">
                        <motion.div
                          className={cn('h-full rounded-full', isRank1 && 'bg-warning')}
                          style={{ background: isRank1 ? undefined : g.group_color }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
