import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { differenceInMinutes, differenceInSeconds } from 'date-fns'
import type { AccentRgb } from '@/lib/accentColor'
import { hexToRgb } from '@/lib/accentColor'
import type { RankedGroup, TxRow } from '@/hooks/useOperationsData'
import type { Action } from '@/types'
import { getMissionStatus } from '@/lib/missionUtils'

// ─── Public types ─────────────────────────────────────────────────────────────

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

// ─── Event data ───────────────────────────────────────────────────────────────

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

// ─── Queue constants ──────────────────────────────────────────────────────────

const MAX_VISIBLE  = 6      // maximum events shown simultaneously
const DELAY_MIN    = 2200   // ms between ambient events
const DELAY_MAX    = 5000
const MILESTONES   = [500, 1000, 2500, 5000, 10_000, 25_000, 50_000]

// Opacity by slot index — newest (0) is most visible, oldest (5) fades out
const SLOT_OPACITY = [1, 0.80, 0.60, 0.44, 0.30, 0.18]

// ─── Event display mapper ─────────────────────────────────────────────────────

interface EventDisplay {
  icon:   string
  color:  string   // accent color for text + border
  glow:   string   // rgba for box-shadow
  bg:     string   // card background gradient
  line1:  string
  line2:  string
}

function getDisplay(data: EventData, accent: AccentRgb, secondNow: Date): EventDisplay {
  switch (data.kind) {

    case 'score': {
      const c = data.bonus
        ? { hex: '#f97316', r: 249, g: 115, b: 22 }
        : { hex: '#22c55e', r: 34,  g: 197, b: 94 }
      return {
        icon:  data.bonus ? '🔥' : '🎉',
        color: c.hex,
        glow:  `rgba(${c.r},${c.g},${c.b},0.25)`,
        bg:    `linear-gradient(135deg,rgba(${c.r},${c.g},${c.b},0.14) 0%,rgba(6,4,14,0.90) 100%)`,
        line1: data.name,
        line2: `+${data.points}${data.bonus ? ` ${data.mult}` : ''} נקודות`,
      }
    }

    case 'bonus':
      return {
        icon:  '🔥',
        color: '#f97316',
        glow:  'rgba(249,115,22,0.25)',
        bg:    'linear-gradient(135deg,rgba(249,115,22,0.16) 0%,rgba(6,4,14,0.90) 100%)',
        line1: data.missionName,
        line2: `×${data.mult} בונוס פעיל!`,
      }

    case 'new_leader':
      return {
        icon:  '👑',
        color: '#eab308',
        glow:  'rgba(234,179,8,0.25)',
        bg:    'linear-gradient(135deg,rgba(234,179,8,0.14) 0%,rgba(6,4,14,0.90) 100%)',
        line1: data.groupName,
        line2: 'עלתה למקום ראשון!',
      }

    case 'rank_up': {
      const medals = ['🥇', '🥈', '🥉']
      const labels = ['מקום ראשון', 'מקום שני', 'מקום שלישי']
      return {
        icon:  medals[data.newRank - 1] ?? '🚀',
        color: data.newRank === 1 ? '#eab308' : data.newRank === 2 ? '#94a3b8' : '#cd7f32',
        glow:  'rgba(234,179,8,0.20)',
        bg:    'linear-gradient(135deg,rgba(234,179,8,0.11) 0%,rgba(6,4,14,0.90) 100%)',
        line1: data.groupName,
        line2: labels[data.newRank - 1] ?? `מקום #${data.newRank}`,
      }
    }

    case 'countdown': {
      const secs    = Math.max(0, differenceInSeconds(new Date(data.endsAt), secondNow))
      const urgent  = secs < 60
      const mm      = String(Math.floor(secs / 60)).padStart(2, '0')
      const ss      = String(secs % 60).padStart(2, '0')
      return {
        icon:  '⏰',
        color: urgent ? '#ef4444' : '#f97316',
        glow:  urgent ? 'rgba(239,68,68,0.25)' : 'rgba(249,115,22,0.20)',
        bg:    `linear-gradient(135deg,${urgent ? 'rgba(239,68,68,0.14)' : 'rgba(249,115,22,0.12)'} 0%,rgba(6,4,14,0.90) 100%)`,
        line1: data.missionName,
        line2: urgent ? `⚡ ${mm}:${ss} לסיום!` : `נשאר ${mm}:${ss}`,
      }
    }

    case 'upcoming':
      return {
        icon:  '🔜',
        color: '#a78bfa',
        glow:  'rgba(167,139,250,0.22)',
        bg:    'linear-gradient(135deg,rgba(139,92,246,0.12) 0%,rgba(6,4,14,0.90) 100%)',
        line1: data.missionName,
        line2: data.minsLeft === 0 ? 'מתחיל עכשיו!' : `מתחיל בעוד ${data.minsLeft} דקות`,
      }

    case 'spotlight': {
      const rgb    = hexToRgb(data.groupColor)
      const medals = ['🥇', '🥈', '🥉']
      const labels = ['מקום ראשון', 'מקום שני', 'מקום שלישי']
      return {
        icon:  medals[data.rank - 1] ?? '⭐',
        color: data.groupColor,
        glow:  `rgba(${rgb.r},${rgb.g},${rgb.b},0.22)`,
        bg:    `linear-gradient(135deg,rgba(${rgb.r},${rgb.g},${rgb.b},0.12) 0%,rgba(6,4,14,0.90) 100%)`,
        line1: data.groupName,
        line2: labels[data.rank - 1] ?? `מקום #${data.rank}`,
      }
    }

    case 'mission_complete':
      return {
        icon:  '🏁',
        color: '#14b8a6',
        glow:  'rgba(20,184,166,0.22)',
        bg:    'linear-gradient(135deg,rgba(20,184,166,0.13) 0%,rgba(6,4,14,0.90) 100%)',
        line1: data.missionName,
        line2: 'המשימה הושלמה! 🎊',
      }

    case 'milestone':
      return {
        icon:  '⭐',
        color: '#fbbf24',
        glow:  'rgba(251,191,36,0.25)',
        bg:    'linear-gradient(135deg,rgba(234,179,8,0.15) 0%,rgba(6,4,14,0.90) 100%)',
        line1: data.groupName,
        line2: `עברה ${data.threshold.toLocaleString('he-IL')} נקודות!`,
      }

    default: {
      const { r, g, b } = accent
      return {
        icon:  '🎮',
        color: `rgb(${r},${g},${b})`,
        glow:  `rgba(${r},${g},${b},0.18)`,
        bg:    `linear-gradient(135deg,rgba(${r},${g},${b},0.09) 0%,rgba(6,4,14,0.90) 100%)`,
        line1: 'מוכנים!',
        line2: 'ממתינים לסריקה הראשונה...',
      }
    }
  }
}

// ─── Ambient playlist builder ─────────────────────────────────────────────────

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

// ─── Single event card ────────────────────────────────────────────────────────
// Cards are completely inert between queue changes.
// `layout` handles the downward shift when a new card is prepended.
// `animate={{ opacity }}` fades each card as its index increases.

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
        className="flex items-center gap-4 rounded-2xl px-5 py-5"
        style={{
          background:  d.bg,
          borderRight: `4px solid ${d.color}`,
          boxShadow:   `0 0 24px ${d.glow}, 0 4px 16px rgba(0,0,0,0.40)`,
        }}
      >
        <span className="shrink-0 select-none leading-none" style={{ fontSize: 46 }}>
          {d.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-black leading-snug text-white">{d.line1}</p>
          <p className="truncate text-[15px] font-bold leading-snug" style={{ color: d.color }}>{d.line2}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  // The queue — newest at index 0 (top), oldest at the bottom
  const [queue, setQueue]         = useState<QueuedEvent[]>([])
  const [glowColor, setGlowColor] = useState('rgba(0,0,0,0)')

  const idRef          = useRef(0)
  const ambientIdxRef  = useRef(0)
  const playlistRef    = useRef(ambientPlaylist)
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevScoreIdRef = useRef<string | null>(null)
  const prevLeaderRef  = useRef<string | null | undefined>(undefined)
  const prevPointsRef  = useRef<Record<string, number> | null>(null)
  const prevMssRef     = useRef<Record<string, string> | null>(null)

  // Keep playlist ref fresh so the timer closure always reads the latest data
  playlistRef.current = ambientPlaylist

  // ── Enqueue: prepend event, drop oldest if over limit ──
  // This is the ONLY mutation of the queue. All animation is driven by
  // Framer Motion's layout system responding to this state change.
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

  // ── Variable-interval auto-advance ──
  // A single recursive timer. Fires → pushes one event → reschedules.
  // No card has its own timer. Nothing moves between firings.
  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const delay = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN)
    timerRef.current = setTimeout(() => {
      enqueue(getNextAmbient())
      scheduleNext()
    }, delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enqueue])

  // Seed 3 events on mount with a short stagger so the feed isn't empty
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

  // Push a live event immediately, then reset the ambient timer so the next
  // ambient event doesn't fire too close after it.
  function insertLive(data: EventData) {
    enqueue(data)
    scheduleNext()
  }

  // ── Live: score submitted ──
  useEffect(() => {
    if (!latestScore || latestScore.id === prevScoreIdRef.current) return
    prevScoreIdRef.current = latestScore.id
    insertLive({ kind: 'score', name: latestScore.name, points: latestScore.points, bonus: latestScore.bonus, mult: latestScore.mult })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestScore?.id])

  // ── Live: leader change ──
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

  // ── Live: milestone ──
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

  // ── Live: mission complete ──
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ direction: 'rtl' }}>

      {/* Atmospheric glow — updates to match the latest event type */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        animate={{ background: `radial-gradient(ellipse at 50% 30%,${glowColor} 0%,transparent 60%)` }}
        transition={{ duration: 2.4, ease: 'easeInOut' }}
      />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse at 50% 50%,transparent 25%,rgba(0,0,0,0.55) 100%)' }}
      />


      {/* ── Event queue ──
          Newest card at the top (index 0). When enqueue() fires, React prepends
          a new item. AnimatePresence + layout shift every existing card down
          by exactly one slot in a single coordinated 380ms animation.
          Nothing moves until the next enqueue(). */}
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
