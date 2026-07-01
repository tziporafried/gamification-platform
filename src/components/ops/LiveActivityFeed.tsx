import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { differenceInMinutes, differenceInSeconds } from 'date-fns'
import type { AccentRgb } from '@/lib/accentColor'
import { hexToRgb } from '@/lib/accentColor'
import type { RankedGroup, TxRow } from '@/hooks/useOperationsData'
import type { Action } from '@/types'
import { getMissionStatus } from '@/lib/missionUtils'

export interface LatestScoreInfo {
  id: string
  name: string
  points: number
  bonus: boolean
  mult: string
}

interface Props {
  rankedGroups: RankedGroup[]
  transactions: TxRow[]
  sortedMissions: Action[]
  bonusMissions: Action[]
  secondNow: Date
  accent: AccentRgb
  latestScore: LatestScoreInfo | null
}

type EventData =
  | { kind: 'score';            name: string; points: number; bonus: boolean; mult: string }
  | { kind: 'bonus';            missionName: string; mult: number }
  | { kind: 'new_leader';       groupName: string; groupColor: string }
  | { kind: 'rank_up';          groupName: string; newRank: number; groupColor: string }
  | { kind: 'countdown';        missionName: string; endsAt: string }
  | { kind: 'upcoming';         missionName: string; minsLeft: number }
  | { kind: 'spotlight';        groupName: string; rank: number; groupColor: string }
  | { kind: 'mission_complete'; missionName: string }
  | { kind: 'milestone';        groupName: string; groupColor: string; threshold: number }
  | { kind: 'ready' }

interface QueuedEvent {
  id: string
  data: EventData
}

const MAX_VISIBLE  = 6
const DELAY_MIN    = 2200
const DELAY_MAX    = 5000
const MILESTONES   = [500, 1000, 2500, 5000, 10_000, 25_000, 50_000]
const SLOT_OPACITY = [1, 0.80, 0.60, 0.44, 0.30, 0.18]

interface EventDisplay {
  icon:   string
  color:  string
  glow:   string
  bg:     string
  line1:  string
  line2:  string
}

function surfaceGradient(token: string): string {
  return `linear-gradient(135deg, color-mix(in srgb, ${token} 14%, transparent) 0%, var(--color-surface) 100%)`
}

function getDisplay(data: EventData, accent: AccentRgb, secondNow: Date): EventDisplay {
  switch (data.kind) {

    case 'score': {
      const token = data.bonus ? 'var(--color-warning)' : 'var(--color-success)'
      return {
        icon:  data.bonus ? '🔥' : '🎉',
        color: token,
        glow:  `color-mix(in srgb, ${token} 25%, transparent)`,
        bg:    surfaceGradient(token),
        line1: data.name,
        line2: `+${data.points}${data.bonus ? ` ${data.mult}` : ''} נקודות`,
      }
    }

    case 'bonus':
      return {
        icon:  '🔥',
        color: 'var(--color-warning)',
        glow:  'color-mix(in srgb, var(--color-warning) 25%, transparent)',
        bg:    surfaceGradient('var(--color-warning)'),
        line1: data.missionName,
        line2: `×${data.mult} בונוס פעיל!`,
      }

    case 'new_leader':
      return {
        icon:  '👑',
        color: 'var(--color-warning)',
        glow:  'color-mix(in srgb, var(--color-warning) 25%, transparent)',
        bg:    surfaceGradient('var(--color-warning)'),
        line1: data.groupName,
        line2: 'עלתה למקום ראשון!',
      }

    case 'rank_up': {
      const medals = ['🥇', '🥈', '🥉']
      const labels = ['מקום ראשון', 'מקום שני', 'מקום שלישי']
      const token = data.newRank === 1
        ? 'var(--color-warning)'
        : data.newRank === 2
          ? 'var(--color-muted)'
          : 'var(--color-accent)'
      return {
        icon:  medals[data.newRank - 1] ?? '🚀',
        color: token,
        glow:  `color-mix(in srgb, ${token} 20%, transparent)`,
        bg:    surfaceGradient(token),
        line1: data.groupName,
        line2: labels[data.newRank - 1] ?? `מקום #${data.newRank}`,
      }
    }

    case 'countdown': {
      const secs    = Math.max(0, differenceInSeconds(new Date(data.endsAt), secondNow))
      const urgent  = secs < 60
      const mm      = String(Math.floor(secs / 60)).padStart(2, '0')
      const ss      = String(secs % 60).padStart(2, '0')
      const token   = urgent ? 'var(--color-danger)' : 'var(--color-warning)'
      return {
        icon:  '⏰',
        color: token,
        glow:  `color-mix(in srgb, ${token} 25%, transparent)`,
        bg:    surfaceGradient(token),
        line1: data.missionName,
        line2: urgent ? `⚡ ${mm}:${ss} לסיום!` : `נשאר ${mm}:${ss}`,
      }
    }

    case 'upcoming':
      return {
        icon:  '🔜',
        color: 'var(--color-primary)',
        glow:  'color-mix(in srgb, var(--color-primary) 22%, transparent)',
        bg:    surfaceGradient('var(--color-primary)'),
        line1: data.missionName,
        line2: data.minsLeft === 0 ? 'מתחיל עכשיו!' : `מתחיל בעוד ${data.minsLeft} דקות`,
      }

    case 'spotlight': {
      const rgb    = hexToRgb(data.groupColor)
      return {
        icon:  ['🥇', '🥈', '🥉'][data.rank - 1] ?? '⭐',
        color: data.groupColor,
        glow:  `rgba(${rgb.r},${rgb.g},${rgb.b},0.22)`,
        bg:    `linear-gradient(135deg, rgba(${rgb.r},${rgb.g},${rgb.b},0.12) 0%, var(--color-surface) 100%)`,
        line1: data.groupName,
        line2: ['מקום ראשון', 'מקום שני', 'מקום שלישי'][data.rank - 1] ?? `מקום #${data.rank}`,
      }
    }

    case 'mission_complete':
      return {
        icon:  '🏁',
        color: 'var(--color-secondary)',
        glow:  'color-mix(in srgb, var(--color-secondary) 22%, transparent)',
        bg:    surfaceGradient('var(--color-secondary)'),
        line1: data.missionName,
        line2: 'המשימה הושלמה! 🎊',
      }

    case 'milestone':
      return {
        icon:  '⭐',
        color: 'var(--color-warning)',
        glow:  'color-mix(in srgb, var(--color-warning) 25%, transparent)',
        bg:    surfaceGradient('var(--color-warning)'),
        line1: data.groupName,
        line2: `עברה ${data.threshold.toLocaleString('he-IL')} נקודות!`,
      }

    default: {
      const { r, g, b } = accent
      return {
        icon:  '🎮',
        color: `rgb(${r},${g},${b})`,
        glow:  `rgba(${r},${g},${b},0.18)`,
        bg:    `linear-gradient(135deg, rgba(${r},${g},${b},0.09) 0%, var(--color-surface) 100%)`,
        line1: 'מוכנים!',
        line2: 'ממתינים לסריקה הראשונה...',
      }
    }
  }
}

function buildAmbient(
  rankedGroups: RankedGroup[],
  transactions: TxRow[],
  sortedMissions: Action[],
  bonusMissions: Action[],
  now: Date,
): EventData[] {
  const list: EventData[] = []

  for (const bm of bonusMissions.slice(0, 2)) {
    const s = getMissionStatus(bm)
    if (s === 'active' || s === 'ending')
      list.push({ kind: 'bonus', missionName: bm.name, mult: Math.max(2, bm.speed_multiplier ?? 2) })
  }

  const ending = sortedMissions.find(m => getMissionStatus(m) === 'ending')
  if (ending?.end_at)
    list.push({ kind: 'countdown', missionName: ending.name, endsAt: ending.end_at })

  if (rankedGroups[0])
    list.push({ kind: 'new_leader', groupName: rankedGroups[0].group_name, groupColor: rankedGroups[0].group_color })

  const active = sortedMissions.find(m => getMissionStatus(m) === 'active' && m.id !== ending?.id)
  if (active?.end_at)
    list.push({ kind: 'countdown', missionName: active.name, endsAt: active.end_at })

  for (const g of rankedGroups.slice(0, 3))
    list.push({ kind: 'spotlight', groupName: g.group_name, rank: g.rank, groupColor: g.group_color })

  const upcoming = sortedMissions.find(m => getMissionStatus(m) === 'upcoming')
  if (upcoming?.start_at)
    list.push({
      kind: 'upcoming',
      missionName: upcoming.name,
      minsLeft: Math.max(0, differenceInMinutes(new Date(upcoming.start_at), now)),
    })

  for (const tx of transactions.slice(0, 4)) {
    if (!tx.participant?.name || !tx.points) continue
    const isBonus = tx.action.points > 0 && tx.points > tx.action.points
    list.push({
      kind: 'score',
      name: tx.participant.name,
      points: tx.points,
      bonus: isBonus,
      mult: isBonus ? `×${Math.round(tx.points / tx.action.points)}` : '',
    })
  }

  if (list.length === 0) list.push({ kind: 'ready' })
  return list
}

function EventCard({
  event, index, accent, secondNow,
}: {
  event: QueuedEvent
  index: number
  accent: AccentRgb
  secondNow: Date
}) {
  const d       = getDisplay(event.data, accent, secondNow)
  const opacity = SLOT_OPACITY[index] ?? 0.12

  return (
    <motion.div
      layout
      layoutId={event.id}
      initial={{ opacity: 0, y: -20, scale: 0.97 }}
      animate={{ opacity, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.22, ease: 'easeIn' } }}
      transition={{
        layout:  { duration: 0.38, ease: [0.4, 0, 0.2, 1] },
        opacity: { duration: 0.38, ease: 'easeOut' },
        y:       { duration: 0.38, ease: 'easeOut' },
        scale:   { duration: 0.38, ease: 'easeOut' },
      }}
    >
      <div
        className="flex items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-5 shadow-card"
        style={{
          background:  d.bg,
          borderRight: `4px solid ${d.color}`,
          boxShadow:   `0 0 24px ${d.glow}`,
        }}
      >
        <span className="shrink-0 select-none leading-none" style={{ fontSize: 46 }}>
          {d.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-black leading-snug text-foreground">{d.line1}</p>
          <p className="truncate text-[15px] font-bold leading-snug" style={{ color: d.color }}>{d.line2}</p>
        </div>
      </div>
    </motion.div>
  )
}

export function LiveActivityFeed({
  rankedGroups,
  transactions,
  sortedMissions,
  bonusMissions,
  secondNow,
  accent,
  latestScore,
}: Props) {
  const ambientPlaylist = useMemo(
    () => buildAmbient(rankedGroups, transactions, sortedMissions, bonusMissions, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rankedGroups, transactions, sortedMissions, bonusMissions],
  )

  const [queue, setQueue]         = useState<QueuedEvent[]>([])
  const [glowColor, setGlowColor] = useState('transparent')

  const idRef          = useRef(0)
  const ambientIdxRef  = useRef(0)
  const playlistRef    = useRef(ambientPlaylist)
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevScoreIdRef = useRef<string | null>(null)
  const prevLeaderRef  = useRef<string | null | undefined>(undefined)
  const prevPointsRef  = useRef<Record<string, number> | null>(null)
  const prevMssRef     = useRef<Record<string, string> | null>(null)

  playlistRef.current = ambientPlaylist

  const enqueue = useCallback((data: EventData) => {
    const id = `e${++idRef.current}`
    setQueue(prev => [{ id, data }, ...prev].slice(0, MAX_VISIBLE))
    setGlowColor(getDisplay(data, accent, new Date()).glow)
  }, [accent])

  function getNextAmbient(): EventData {
    const pl = playlistRef.current
    if (!pl.length) return { kind: 'ready' }
    const item = pl[ambientIdxRef.current % pl.length]
    ambientIdxRef.current++
    return item
  }

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const delay = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN)
    timerRef.current = setTimeout(() => {
      enqueue(getNextAmbient())
      scheduleNext()
    }, delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enqueue])

  useEffect(() => {
    const pl = playlistRef.current
    const seed = Math.min(3, Math.max(pl.length, 1))
    for (let i = 0; i < seed; i++) {
      const data = pl[i] ?? ({ kind: 'ready' } as EventData)
      setTimeout(() => enqueue(data), i * 500)
    }
    ambientIdxRef.current = seed
    setTimeout(() => scheduleNext(), seed * 500 + 600)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function insertLive(data: EventData) {
    enqueue(data)
    scheduleNext()
  }

  useEffect(() => {
    if (!latestScore || latestScore.id === prevScoreIdRef.current) return
    prevScoreIdRef.current = latestScore.id
    insertLive({ kind: 'score', name: latestScore.name, points: latestScore.points, bonus: latestScore.bonus, mult: latestScore.mult })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestScore?.id])

  useEffect(() => {
    const id = rankedGroups[0]?.group_id ?? null
    if (prevLeaderRef.current === undefined) { prevLeaderRef.current = id; return }
    if (id && id !== prevLeaderRef.current) {
      const g = rankedGroups[0]
      insertLive({ kind: 'new_leader', groupName: g.group_name, groupColor: g.group_color })
    }
    prevLeaderRef.current = id
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankedGroups])

  useEffect(() => {
    if (!prevPointsRef.current) {
      prevPointsRef.current = Object.fromEntries(rankedGroups.map(g => [g.group_id, g.total_points]))
      return
    }
    for (const g of rankedGroups) {
      const prev = prevPointsRef.current[g.group_id] ?? 0
      for (const t of MILESTONES) {
        if (prev < t && g.total_points >= t)
          insertLive({ kind: 'milestone', groupName: g.group_name, groupColor: g.group_color, threshold: t })
      }
      prevPointsRef.current[g.group_id] = g.total_points
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankedGroups])

  useEffect(() => {
    if (!prevMssRef.current) {
      prevMssRef.current = Object.fromEntries(sortedMissions.map(m => [m.id, getMissionStatus(m)]))
      return
    }
    for (const m of sortedMissions) {
      const prev = prevMssRef.current[m.id]
      const curr = getMissionStatus(m)
      if ((prev === 'active' || prev === 'ending') && curr === 'ended')
        insertLive({ kind: 'mission_complete', missionName: m.name })
      prevMssRef.current[m.id] = curr
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedMissions])

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background" style={{ direction: 'rtl' }}>
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        animate={{ background: `radial-gradient(ellipse at 50% 30%,${glowColor} 0%,transparent 60%)` }}
        transition={{ duration: 2.4, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex flex-1 flex-col justify-between">
        <AnimatePresence initial={false}>
          {queue.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              index={index}
              accent={accent}
              secondNow={secondNow}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
