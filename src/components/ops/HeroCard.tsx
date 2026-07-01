import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getMissionStatus, getSecondsLeft } from '@/lib/missionUtils'
import type { Action } from '@/types'
import type { TxRow, RankedGroup } from '@/hooks/useOperationsData'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'
import { cn } from '@/lib/utils'

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  sortedMissions: Action[]
  bonusMissions: Action[]
  transactions: TxRow[]
  rankedGroups: RankedGroup[]
  secondNow: Date
  accent: AccentRgb
}

// ── State types ────────────────────────────────────────────────────────────────

type HeroState =
  | { kind: 'speed_bonus';      mission: Action; mult: number; label: string }
  | { kind: 'mission_ending';   mission: Action }
  | { kind: 'upcoming_mission'; mission: Action }
  | { kind: 'recommended';      mission: Action }
  | { kind: 'popular';          missionName: string; count: number }
  | { kind: 'game_stats';       txCount: number; totalPts: number; groupCount: number }
  | { kind: 'motivational';     text: string; icon: string }

// ── Priority computation (re-runs every second via secondNow dep) ──────────────

function computePriority(sortedMissions: Action[], bonusMissions: Action[]): HeroState | null {
  for (const m of bonusMissions) {
    const s = getMissionStatus(m)
    if (s === 'active' || s === 'ending') {
      const mult = Math.max(2, m.speed_multiplier ?? 2)
      const label = m.speed_bonus_flat_points != null ? `+${m.speed_bonus_flat_points}` : `×${mult}`
      return { kind: 'speed_bonus', mission: m, mult, label }
    }
  }

  const ending = sortedMissions.find(m => getMissionStatus(m) === 'ending' && m.time_enabled && m.end_at)
  if (ending) return { kind: 'mission_ending', mission: ending }

  const upcoming = sortedMissions.find(m => getMissionStatus(m) === 'upcoming' && m.time_enabled && m.start_at)
  if (upcoming) return { kind: 'upcoming_mission', mission: upcoming }

  return null
}

// ── Fallback rotation items ────────────────────────────────────────────────────

function computeFallbacks(sortedMissions: Action[], transactions: TxRow[], rankedGroups: RankedGroup[]): HeroState[] {
  const items: HeroState[] = []

  for (const m of sortedMissions.filter(m => getMissionStatus(m) === 'available')) {
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

// ── Big digit countdown ────────────────────────────────────────────────────────

function BigCountdown({ secsLeft, urgent }: { secsLeft: number | null; urgent: boolean }) {
  const secs = Math.max(0, secsLeft ?? 0)
  const timeStr = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

  return (
    <div className="flex items-center justify-center gap-1" dir="ltr">
      {timeStr.split('').map((ch, i) =>
        ch === ':' ? (
          <span
            key={`sep-${i}`}
            className={cn('pb-1 text-5xl font-black', urgent ? 'text-danger/60' : 'text-muted')}
            style={{ lineHeight: 1 }}
          >
            :
          </span>
        ) : (
          <div
            key={`box-${i}`}
            className={cn(
              'flex items-center justify-center overflow-hidden rounded-xl border font-black tabular-nums',
              urgent
                ? 'border-danger bg-surface-elevated text-danger'
                : 'border-border bg-surface-elevated text-foreground',
            )}
            style={{ width: 52, height: 64, fontSize: 40 }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                initial={{ y: -22, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 22, opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </div>
        )
      )}
    </div>
  )
}

// ── Card renderers ─────────────────────────────────────────────────────────────

function SpeedBonusCard({ state, secondNow }: { state: Extract<HeroState, { kind: 'speed_bonus' }>; secondNow: Date }) {
  const secsLeft = getSecondsLeft(state.mission, secondNow)
  const urgent = secsLeft !== null && secsLeft < 60

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <motion.span
        className="select-none leading-none"
        style={{ fontSize: 96 }}
        animate={{ scale: [1, 1.07, 1] }}
        transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
      >
        🔥
      </motion.span>
      <div>
        <p className="text-4xl font-black text-warning">{state.label} בונוס!</p>
        <p className="mt-1 text-lg text-muted">{state.mission.name}</p>
      </div>
      {secsLeft !== null && state.mission.end_at && (
        <>
          <BigCountdown secsLeft={secsLeft} urgent={urgent} />
          <p className="text-sm text-muted">נשארו</p>
        </>
      )}
    </div>
  )
}

function MissionEndingCard({ state, secondNow }: { state: Extract<HeroState, { kind: 'mission_ending' }>; secondNow: Date }) {
  const secsLeft = getSecondsLeft(state.mission, secondNow)
  const urgent = secsLeft !== null && secsLeft < 60

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <motion.span
        className="select-none leading-none"
        style={{ fontSize: 96 }}
        animate={{ rotate: urgent ? [0, -8, 8, -8, 0] : [0, -4, 4, 0] }}
        transition={{ duration: urgent ? 0.45 : 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        ⏰
      </motion.span>
      <div>
        <p className="text-2xl font-black text-foreground">{state.mission.name}</p>
        <p className="mt-1 text-sm text-muted">מסתיימת בעוד</p>
      </div>
      <BigCountdown secsLeft={secsLeft} urgent={urgent} />
    </div>
  )
}

function UpcomingMissionCard({ state, secondNow }: { state: Extract<HeroState, { kind: 'upcoming_mission' }>; secondNow: Date }) {
  const secsLeft = getSecondsLeft(state.mission, secondNow)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <span className="select-none leading-none" style={{ fontSize: 96 }}>🔜</span>
      <div>
        <p className="text-2xl font-black text-foreground">{state.mission.name}</p>
        <p className="mt-1 text-sm text-muted">מתחילה בעוד</p>
      </div>
      <BigCountdown secsLeft={secsLeft} urgent={false} />
    </div>
  )
}

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

export function HeroCard({ sortedMissions, bonusMissions, transactions, rankedGroups, secondNow, accent }: Props) {
  const [rotIdx, setRotIdx] = useState(0)

  // Re-runs every second (secondNow dep) so mission status changes are caught live
  const priorityState = useMemo(
    () => computePriority(sortedMissions, bonusMissions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedMissions, bonusMissions, secondNow],
  )

  const fallbackItems = useMemo(
    () => computeFallbacks(sortedMissions, transactions, rankedGroups),
    [sortedMissions, transactions, rankedGroups],
  )

  useEffect(() => {
    if (priorityState) { setRotIdx(0); return }
    const t = setInterval(() => setRotIdx(p => (p + 1) % fallbackItems.length), 9000)
    return () => clearInterval(t)
  }, [priorityState, fallbackItems.length])

  const current = priorityState ?? fallbackItems[rotIdx % fallbackItems.length]

  const stateKey = useMemo(() => {
    switch (current.kind) {
      case 'speed_bonus':      return `bonus-${current.mission.id}`
      case 'mission_ending':   return `ending-${current.mission.id}`
      case 'upcoming_mission': return `upcoming-${current.mission.id}`
      case 'recommended':      return `rec-${current.mission.id}`
      case 'popular':          return `pop-${current.missionName}`
      case 'game_stats':       return 'stats'
      case 'motivational':     return `mot-${current.icon}`
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
          {current.kind === 'speed_bonus'      && <SpeedBonusCard      state={current} secondNow={secondNow} />}
          {current.kind === 'mission_ending'   && <MissionEndingCard   state={current} secondNow={secondNow} />}
          {current.kind === 'upcoming_mission' && <UpcomingMissionCard state={current} secondNow={secondNow} />}
          {current.kind === 'recommended'      && <RecommendedCard     state={current} accent={accent} />}
          {current.kind === 'popular'          && <PopularCard         state={current} />}
          {current.kind === 'game_stats'       && <GameStatsCard       state={current} />}
          {current.kind === 'motivational'     && <MotivationalCard    state={current} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
