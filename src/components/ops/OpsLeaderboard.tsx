import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import type { RankedGroup } from '@/hooks/useOperationsData'

interface Props {
  rankedGroups: RankedGroup[]
  titlePulse?: boolean
}

const MEDAL = ['🥇', '🥈', '🥉']
const RANK_COLORS = ['#eab308', '#a1a1aa', '#ea580c']

const CONFETTI_COLORS = ['#fbbf24', '#f97316', '#a855f7', '#22c55e', '#ec4899', '#06b6d4', '#8b5cf6']

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
      // First load — just record ranks, don't trigger animations
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

    // Update ref after detection
    const m = new Map<string, number>()
    for (const g of rankedGroups) m.set(g.group_id, g.rank)
    prevRanksRef.current = m
  }, [rankedGroups])

  // Update prevRanks when no animation fires
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
      {/* Title */}
      <motion.div
        className="flex items-center gap-2"
        animate={titlePulse ? { y: [0, -3, 0] } : {}}
        transition={{ duration: 0.3 }}>
        <Trophy size={16} className="text-amber-400" />
        <span className="text-sm font-black text-white">דירוג קבוצות</span>
      </motion.div>

      {rankedGroups.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-600">אין נתוני קבוצות עדיין</p>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {rankedGroups.slice(0, 6).map(g => {
              const isImproved = improvedGroups.has(g.group_id)
              const isNewTop3 = newTop3Groups.has(g.group_id)
              const isRank1 = rank1Group === g.group_id
              const pct = Math.round((g.total_points / maxPts) * 100)
              const rankColor = RANK_COLORS[g.rank - 1] || 'rgba(99,102,241,0.7)'
              const isTop3 = g.rank <= 3

              return (
                <motion.div
                  key={g.group_id}
                  layout
                  layoutId={`ops-lb-${g.group_id}`}
                  className="relative rounded-xl p-3 overflow-hidden"
                  style={{
                    background: isRank1
                      ? 'rgba(234,179,8,0.08)'
                      : isTop3
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(255,255,255,0.025)',
                    border: isRank1
                      ? '1px solid rgba(234,179,8,0.4)'
                      : isTop3
                        ? '1px solid rgba(255,255,255,0.08)'
                        : '1px solid rgba(255,255,255,0.05)',
                    boxShadow: isRank1 ? '0 0 16px rgba(234,179,8,0.2)' : 'none',
                  }}
                  animate={isImproved ? { backgroundColor: ['rgba(250,204,21,0.2)', 'rgba(0,0,0,0)'] } : {}}
                  transition={{
                    layout: { duration: 0.4, ease: 'easeInOut' },
                    backgroundColor: { duration: 0.9 },
                  }}>

                  {/* Confetti on top-3 entry */}
                  <ConfettiBurst active={isNewTop3} />

                  <div className="relative flex items-center gap-2.5">
                    {/* Rank badge */}
                    <div className="shrink-0 flex flex-col items-center">
                      {isTop3 ? (
                        <motion.span
                          className="text-xl leading-none"
                          animate={isImproved ? { scale: [1, 1.5, 1] } : {}}
                          transition={{ duration: 0.45 }}>
                          {MEDAL[g.rank - 1]}
                        </motion.span>
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white"
                          style={{ background: rankColor }}>
                          {g.rank}
                        </div>
                      )}
                    </div>

                    {/* Group info */}
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
                          <span className={`font-black text-white truncate ${isTop3 ? 'text-sm' : 'text-xs'}`}>{g.group_name}</span>
                        </div>
                        <span className={`font-black text-white shrink-0 tabular-nums ${isTop3 ? 'text-sm' : 'text-xs'}`}>
                          <AnimatedCounter value={g.total_points} duration={600} />
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: isRank1 ? 'linear-gradient(90deg, #eab308, #f97316)' : g.group_color }}
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
