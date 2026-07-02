import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Action } from '@/types'
import type { TxRow, RankedGroup } from '@/hooks/useOperationsData'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  missions: Action[]
  transactions: TxRow[]
  rankedGroups: RankedGroup[]
  accent: AccentRgb
}

// ── State types ────────────────────────────────────────────────────────────────

type HeroState =
  | { kind: 'recommended';  mission: Action }
  | { kind: 'popular';      missionName: string; count: number }
  | { kind: 'game_stats';   txCount: number; totalPts: number; groupCount: number }
  | { kind: 'motivational'; text: string; icon: string }

// ── Fallback rotation items ────────────────────────────────────────────────────

function computeFallbacks(missions: Action[], transactions: TxRow[], rankedGroups: RankedGroup[]): HeroState[] {
  const items: HeroState[] = []

  for (const m of missions) {
    items.push({ kind: 'recommended', mission: m })
  }

  if (transactions.length > 0) {
    const counts: Record<string, { name: string; count: number }> = {}
    for (const tx of transactions) {
      const name = tx.action?.name
      if (!name) continue
      counts[name] = counts[name] ?? { name, count: 0 }
      counts[name].count++
    }
    const top = Object.values(counts).sort((a, b) => b.count - a.count)[0]
    if (top && top.count >= 2) items.push({ kind: 'popular', missionName: top.name, count: top.count })
  }

  const totalPts = rankedGroups.reduce((s, g) => s + g.total_points, 0)
  items.push({
    kind: 'game_stats',
    txCount: transactions.length,
    totalPts,
    groupCount: rankedGroups.filter(g => g.total_points > 0).length,
  })

  const leader = rankedGroups[0]
  const second = rankedGroups[1]
  if (leader && second && second.total_points > 0) {
    const gap = leader.total_points - second.total_points
    items.push({ kind: 'motivational', icon: '⚡', text: `${gap.toLocaleString('he-IL')} נקודות מפרידות בין מקום ראשון לשני!` })
  }
  const third = rankedGroups[2]
  if (leader && third && third.total_points > 0) {
    const gap = leader.total_points - third.total_points
    items.push({ kind: 'motivational', icon: '🏆', text: `רק ${gap.toLocaleString('he-IL')} נקודות בין מקום ראשון לשלישי!` })
  }

  if (items.length === 0) items.push({ kind: 'motivational', icon: '🎮', text: 'ממתינים לסריקה הראשונה — בהצלחה!' })

  return items
}

// ── Card renderers ─────────────────────────────────────────────────────────────

function RecommendedCard({ state, accent }: { state: Extract<HeroState, { kind: 'recommended' }>; accent: AccentRgb }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <motion.span
        className="select-none leading-none"
        style={{ fontSize: 96 }}
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        🎯
      </motion.span>
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted mb-2">משימה מומלצת</p>
        <p className="text-3xl font-black text-foreground">{state.mission.name}</p>
        <p className="mt-3 text-2xl font-black" style={{ color: rgba(accent, 1) }}>
          +{state.mission.points} נקודות
        </p>
      </div>
    </div>
  )
}

function PopularCard({ state }: { state: Extract<HeroState, { kind: 'popular' }> }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <motion.span
        className="select-none leading-none"
        style={{ fontSize: 96 }}
        animate={{ scale: [1, 1.07, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        🔥
      </motion.span>
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted mb-2">כולם עושים...</p>
        <p className="text-3xl font-black text-foreground">{state.missionName}</p>
        <p className="mt-2 text-sm text-muted">{state.count} השלמות</p>
      </div>
    </div>
  )
}

function GameStatsCard({ state }: { state: Extract<HeroState, { kind: 'game_stats' }> }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <span className="select-none leading-none" style={{ fontSize: 80 }}>📊</span>
      <p className="text-[11px] font-black uppercase tracking-widest text-muted">סטטיסטיקות משחק</p>
      <div className="flex flex-col gap-5 w-full">
        <div>
          <p className="text-5xl font-black tabular-nums text-foreground">{state.txCount}</p>
          <p className="mt-1 text-sm text-muted">משימות הושלמו</p>
        </div>
        <div>
          <p className="text-5xl font-black tabular-nums text-success">
            {state.totalPts.toLocaleString('he-IL')}
          </p>
          <p className="mt-1 text-sm text-muted">נקודות חולקו</p>
        </div>
        {state.groupCount > 0 && (
          <div>
            <p className="text-4xl font-black tabular-nums text-foreground">{state.groupCount}</p>
            <p className="mt-1 text-sm text-muted">קבוצות פעילות</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MotivationalCard({ state }: { state: Extract<HeroState, { kind: 'motivational' }> }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center px-2">
      <motion.span
        className="select-none leading-none"
        style={{ fontSize: 96 }}
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {state.icon}
      </motion.span>
      <p className="text-2xl font-black leading-snug text-foreground">{state.text}</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HeroCard({ missions, transactions, rankedGroups, accent }: Props) {
  const [rotIdx, setRotIdx] = useState(0)

  const fallbackItems = useMemo(
    () => computeFallbacks(missions, transactions, rankedGroups),
    [missions, transactions, rankedGroups],
  )

  useEffect(() => {
    const t = setInterval(() => setRotIdx(p => (p + 1) % fallbackItems.length), 9000)
    return () => clearInterval(t)
  }, [fallbackItems.length])

  const current = fallbackItems[rotIdx % fallbackItems.length]

  const stateKey = useMemo(() => {
    switch (current.kind) {
      case 'recommended':  return `rec-${current.mission.id}`
      case 'popular':      return `pop-${current.missionName}`
      case 'game_stats':   return 'stats'
      case 'motivational': return `mot-${current.icon}`
    }
  }, [current])

  return (
    <div className="flex h-full flex-col" style={{ direction: 'rtl' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={stateKey}
          className="flex-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.38, ease: 'easeInOut' }}
        >
          {current.kind === 'recommended'  && <RecommendedCard  state={current} accent={accent} />}
          {current.kind === 'popular'      && <PopularCard      state={current} />}
          {current.kind === 'game_stats'   && <GameStatsCard    state={current} />}
          {current.kind === 'motivational' && <MotivationalCard state={current} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
