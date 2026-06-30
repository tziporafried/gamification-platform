import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { RankedGroup, TxRow } from '@/hooks/useOperationsData'
import type { AccentRgb } from '@/lib/accentColor'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'

interface Props {
  rankedGroups: RankedGroup[]
  transactions: TxRow[]
  accent: AccentRgb
}

type ViewKind = 'leaderboard' | 'battle' | 'recent' | 'achievements'

const ROTATION_MS = 17000
const MEDALS = ['🥇', '🥈', '🥉']
const RANK_COLORS_HEX = ['#eab308', '#a1a1aa', '#ea580c']

const SLIDE = {
  enter: { x: 36, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -36, opacity: 0 },
}
const SLIDE_T = { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const }

// ── Leaderboard ────────────────────────────────────────────────────────────────

function LeaderboardView({ rankedGroups, accent }: { rankedGroups: RankedGroup[]; accent: AccentRgb }) {
  const { r: ar, g: ag, b: ab } = accent
  const maxPts = rankedGroups[0]?.total_points || 1

  if (rankedGroups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-lg font-black text-gray-600">ממתינים לסריקה הראשונה...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <p className="shrink-0 text-xs font-black uppercase tracking-widest text-gray-500">דירוג קבוצות</p>
      <div className="flex flex-1 flex-col justify-between overflow-hidden">
        {rankedGroups.slice(0, 8).map(g => {
          const isFirst = g.rank === 1
          const isTop3 = g.rank <= 3
          const pct = maxPts > 0 ? Math.round((g.total_points / maxPts) * 100) : 0
          const medal = MEDALS[g.rank - 1]
          const rankColor = RANK_COLORS_HEX[g.rank - 1] ?? `rgba(${ar},${ag},${ab},0.7)`

          return (
            <motion.div
              key={g.group_id}
              layout
              layoutId={`cp-lb-${g.group_id}`}
              className="relative overflow-hidden rounded-2xl"
              style={{
                background: isFirst
                  ? 'linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(6,4,14,0.92) 100%)'
                  : isTop3
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(255,255,255,0.025)',
                border: isFirst
                  ? '1.5px solid rgba(234,179,8,0.45)'
                  : isTop3
                    ? '1px solid rgba(255,255,255,0.08)'
                    : '1px solid rgba(255,255,255,0.04)',
                boxShadow: isFirst ? '0 0 28px rgba(234,179,8,0.18)' : 'none',
                padding: isFirst ? '14px 16px' : isTop3 ? '10px 14px' : '8px 12px',
              }}
              transition={{ layout: { duration: 0.4, ease: 'easeInOut' } }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 shrink-0 text-center">
                  {medal ? (
                    <span style={{ fontSize: isFirst ? 34 : 26, lineHeight: 1 }}>{medal}</span>
                  ) : (
                    <div
                      className="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-white"
                      style={{ background: rankColor }}
                    >
                      {g.rank}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: g.group_color }} />
                      <span
                        className="truncate font-black text-white"
                        style={{ fontSize: isFirst ? 20 : isTop3 ? 16 : 14 }}
                      >
                        {g.group_name}
                      </span>
                    </div>
                    <span
                      className="shrink-0 tabular-nums font-black"
                      style={{ fontSize: isFirst ? 20 : isTop3 ? 15 : 13, color: isFirst ? '#eab308' : 'white' }}
                    >
                      <AnimatedCounter value={g.total_points} duration={600} />
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: isFirst ? 'linear-gradient(90deg,#eab308,#f97316)' : g.group_color }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ── Closest Battle ─────────────────────────────────────────────────────────────

function ClosestBattleView({ rankedGroups }: { rankedGroups: RankedGroup[] }) {
  const g1 = rankedGroups[0]
  const g2 = rankedGroups[1]
  if (!g1 || !g2 || g2.total_points === 0) return null

  const gap = g1.total_points - g2.total_points

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center" dir="rtl">
      <p className="text-xs font-black uppercase tracking-widest text-gray-500">קרב בראש הדירוג</p>

      <div>
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: g1.group_color }} />
          <p className="text-5xl font-black text-white">{g1.group_name}</p>
        </div>
        <p className="text-6xl font-black tabular-nums" style={{ color: '#eab308' }}>
          {g1.total_points.toLocaleString('he-IL')}
        </p>
        <p className="mt-1 text-base text-gray-500">נקודות</p>
      </div>

      <div className="flex w-full items-center gap-4 px-6">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-2xl font-black text-gray-600">VS</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: g2.group_color }} />
          <p className="text-5xl font-black text-white">{g2.group_name}</p>
        </div>
        <p className="text-6xl font-black tabular-nums text-gray-300">
          {g2.total_points.toLocaleString('he-IL')}
        </p>
        <p className="mt-1 text-base text-gray-500">נקודות</p>
      </div>

      <div
        className="rounded-2xl px-6 py-3"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <p className="text-lg font-black text-white">
          רק {gap.toLocaleString('he-IL')} נקודות הפרש!
        </p>
      </div>
    </div>
  )
}

// ── Recent Missions ────────────────────────────────────────────────────────────

function RecentMissionsView({ transactions }: { transactions: TxRow[] }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="shrink-0 text-xs font-black uppercase tracking-widest text-gray-500">משימות אחרונות</p>
      <div className="flex flex-1 flex-col justify-between overflow-hidden">
        {transactions.slice(0, 6).map((tx, i) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span className="shrink-0 select-none text-3xl">🎯</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-white">{tx.action?.name ?? '—'}</p>
              <p className="truncate text-sm text-gray-500">{tx.participant?.name ?? '—'}</p>
            </div>
            <span className="shrink-0 text-base font-black text-emerald-400">+{tx.points}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Achievements ───────────────────────────────────────────────────────────────

function AchievementsView({ rankedGroups, transactions }: { rankedGroups: RankedGroup[]; transactions: TxRow[] }) {
  const items = useMemo(() => {
    const list: Array<{ icon: string; title: string; sub: string }> = []
    const leader = rankedGroups[0]
    const second = rankedGroups[1]
    const totalPts = rankedGroups.reduce((s, g) => s + g.total_points, 0)

    if (leader && leader.total_points > 0) {
      list.push({
        icon: '👑',
        title: leader.group_name,
        sub: `מוביל עם ${leader.total_points.toLocaleString('he-IL')} נקודות`,
      })
    }
    if (leader && second && second.total_points > 0) {
      const gap = leader.total_points - second.total_points
      list.push({
        icon: '⚡',
        title: `${gap.toLocaleString('he-IL')} נקודות הפרש`,
        sub: `בין ${leader.group_name} ל-${second.group_name}`,
      })
    }
    if (transactions.length > 0) {
      list.push({
        icon: '🎯',
        title: `${transactions.length} משימות הושלמו`,
        sub: `${totalPts.toLocaleString('he-IL')} נקודות חולקו`,
      })
    }
    if (list.length === 0) {
      list.push({ icon: '🚀', title: 'המשחק מתחיל!', sub: 'סרקו משימות ועלו בדירוג' })
    }
    return list
  }, [rankedGroups, transactions])

  return (
    <div className="flex h-full flex-col gap-4">
      <p className="shrink-0 text-xs font-black uppercase tracking-widest text-gray-500">הישגים</p>
      <div className="flex flex-1 flex-col justify-between">
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.09, duration: 0.35 }}
            className="flex items-center gap-4 rounded-2xl px-5 py-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="shrink-0 select-none text-4xl">{item.icon}</span>
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-white">{item.title}</p>
              <p className="truncate text-sm text-gray-500">{item.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Dot indicators ─────────────────────────────────────────────────────────────

function Dots({ total, active, accent }: { total: number; active: number; accent: AccentRgb }) {
  if (total <= 1) return null
  const { r, g, b } = accent
  return (
    <div className="flex shrink-0 justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={{ width: i === active ? 14 : 5, opacity: i === active ? 1 : 0.25 }}
          transition={{ duration: 0.28 }}
          style={{ height: 5, background: `rgb(${r},${g},${b})` }}
        />
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function CompetitionPanel({ rankedGroups, transactions, accent }: Props) {
  const [viewIdx, setViewIdx] = useState(0)

  const views = useMemo<ViewKind[]>(() => {
    const v: ViewKind[] = ['leaderboard']
    if (rankedGroups.filter(g => g.total_points > 0).length >= 2) v.push('battle')
    if (transactions.length > 0) v.push('recent')
    v.push('achievements')
    return v
  }, [rankedGroups, transactions])

  useEffect(() => {
    const t = setInterval(() => setViewIdx(prev => (prev + 1) % views.length), ROTATION_MS)
    return () => clearInterval(t)
  }, [views.length])

  const activeView = views[viewIdx % views.length]

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden" style={{ direction: 'rtl' }}>
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            className="absolute inset-0"
            variants={SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SLIDE_T}
          >
            {activeView === 'leaderboard' && <LeaderboardView rankedGroups={rankedGroups} accent={accent} />}
            {activeView === 'battle'      && <ClosestBattleView rankedGroups={rankedGroups} />}
            {activeView === 'recent'      && <RecentMissionsView transactions={transactions} />}
            {activeView === 'achievements' && <AchievementsView rankedGroups={rankedGroups} transactions={transactions} />}
          </motion.div>
        </AnimatePresence>
      </div>
      <Dots total={views.length} active={viewIdx % views.length} accent={accent} />
    </div>
  )
}
