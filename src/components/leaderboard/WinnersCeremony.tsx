import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Maximize2, Minimize2, RotateCcw, Trophy, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { computeRanks } from '@/lib/missionUtils'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'
import { useCelebrationSound } from '@/hooks/useCelebrationSound'
import { SoundToggle } from './SoundToggle'
import { LeaderboardEmptyState } from './LeaderboardEmptyState'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Spinner } from '@/components/ui/Spinner'
import type { GroupLeaderboardEntry, ParticipantLeaderboardEntry } from '@/types'

interface WinnersCeremonyProps {
  eventId: string
  eventName?: string
  eventLogoUrl?: string | null
}

interface TxRow {
  id: string
  participant_id: string
  action_id: string
  points: number
  created_at: string
  participant: { name: string; external_id: string }
  action: { name: string; code: string }
}

interface PgMapping {
  participant_id: string
  groups: { id: string; name: string; color: string } | null
}

type RankedParticipant = ParticipantLeaderboardEntry & { rank: number }
type RankedGroup = GroupLeaderboardEntry & { rank: number }
type PhaseKind =
  | 'suspense'
  | 'groupChampion'
  | 'groupPodium'
  | 'groupLeaderboard'
  | 'participantChampion'
  | 'participantPodium'
  | 'participantLeaderboard'
  | 'groupMissions'
  | 'participantMissions'

interface PhaseDef {
  kind: PhaseKind
  duration: number
  dot: number
}

interface MissionWinner {
  id: string
  name: string
  count: number
  color?: string
}

const DEFAULT_REVEAL_SPEED = 1
const AUTO_LOOP = true
const CONTENT_SCALE = 0.82
const GOLD = '#FFB800'
const DEEP_GOLD = '#C8890B'
const ORANGE = '#FF6B35'
const WARM_ORANGE = '#FF9366'
const TEAL = '#50A49D'
const GREEN = '#45CF6B'
const INK = '#2E221E'
const MEDALS = ['🥇', '🥈', '🥉']
const CONFETTI_COLORS = [GOLD, ORANGE, WARM_ORANGE, '#FFD68A', TEAL, GREEN, DEEP_GOLD]

function AnimatedNumber({ value, duration = 1600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    if (value === 0) {
      setDisplay(0)
      return undefined
    }
    const start = performance.now()
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1)
      setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * value))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [duration, value])

  return <>{display.toLocaleString('he-IL')}</>
}

function useCeremonyScale() {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    let raf = 0
    const retryDelays = [0, 60, 120, 250, 400, 700, 1000]
    const retryTimers: number[] = []

    function measure() {
      const width = window.innerWidth || document.body.clientWidth || document.documentElement.clientWidth
      const height = window.innerHeight || document.body.clientHeight || document.documentElement.clientHeight
      if (width <= 0 || height <= 0) return
      setScale(Math.min(width / 1920, height / 1080, 1))
    }

    function scheduleMeasure() {
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(measure)
    }

    retryDelays.forEach((delay) => {
      retryTimers.push(window.setTimeout(measure, delay))
    })

    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(document.body)
    window.addEventListener('resize', scheduleMeasure)
    scheduleMeasure()

    return () => {
      window.cancelAnimationFrame(raf)
      retryTimers.forEach((timer) => window.clearTimeout(timer))
      observer.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [])

  return scale
}

function useLeaderboardData(eventId: string) {
  const [participantData, setParticipantData] = useState<ParticipantLeaderboardEntry[]>([])
  const [groupData, setGroupData] = useState<GroupLeaderboardEntry[]>([])
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [pgMap, setPgMap] = useState<Map<string, { id: string; name: string; color: string }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const [pRes, gRes, txRes] = await Promise.all([
        supabase.rpc('get_participant_leaderboard', { p_event_id: eventId }),
        supabase.rpc('get_group_leaderboard', { p_event_id: eventId }),
        supabase
          .from('point_transactions')
          .select('id, participant_id, action_id, points, created_at, participant:participants(name, external_id), action:actions(name, code)')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(200),
      ])
      if (pRes.error || gRes.error) {
        setError('טבלת הדירוג בהכנה. אנא נסו שוב בקרוב.')
        setLoading(false)
        return
      }

      const pData = (pRes.data ?? []) as ParticipantLeaderboardEntry[]
      const gData = (gRes.data ?? []) as GroupLeaderboardEntry[]
      setParticipantData(pData)
      setGroupData(gData)
      setTransactions((txRes.data ?? []) as unknown as TxRow[])

      if (pData.length > 0) {
        const ids = pData.map((p) => p.participant_id)
        const allPg: PgMapping[] = []
        for (let i = 0; i < ids.length; i += 100) {
          const { data } = await supabase
            .from('participant_groups')
            .select('participant_id, groups(id, name, color)')
            .in('participant_id', ids.slice(i, i + 100))
          if (data) allPg.push(...(data as unknown as PgMapping[]))
        }
        const map = new Map<string, { id: string; name: string; color: string }>()
        for (const m of allPg) {
          if (m.groups) map.set(m.participant_id, m.groups)
        }
        setPgMap(map)
      }
      setLoading(false)
    } catch {
      setError('שגיאה בטעינת הנתונים.')
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const rankedP = useMemo(() => computeRanks(participantData), [participantData])
  const rankedG = useMemo(() => computeRanks(groupData), [groupData])
  const hasGroups = groupData.length > 0
  const taskCountByP = useMemo(() => {
    const m = new Map<string, number>()
    for (const tx of transactions) m.set(tx.participant_id, (m.get(tx.participant_id) || 0) + 1)
    return m
  }, [transactions])
  const groupTaskCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const [pid, c] of taskCountByP) {
      const g = pgMap.get(pid)
      if (g) m.set(g.id, (m.get(g.id) || 0) + c)
    }
    return m
  }, [taskCountByP, pgMap])
  const topPByGroup = useMemo(() => {
    const m = new Map<string, { name: string }>()
    for (const p of rankedP) {
      const g = pgMap.get(p.participant_id)
      if (!g) continue
      if (!m.has(g.id)) m.set(g.id, { name: p.participant_name })
    }
    return m
  }, [rankedP, pgMap])
  const taskStats = useMemo(() => {
    const m = new Map<string, { name: string; count: number; points: number }>()
    for (const tx of transactions) {
      const c = m.get(tx.action_id)
      if (c) {
        c.count++
        c.points += tx.points
      } else {
        m.set(tx.action_id, { name: tx.action?.name ?? '', count: 1, points: tx.points })
      }
    }
    return [...m.values()].sort((a, b) => b.count - a.count)
  }, [transactions])

  return {
    rankedP,
    rankedG,
    hasGroups,
    taskCountByP,
    groupTaskCounts,
    topPByGroup,
    taskStats,
    pgMap,
    loading,
    error,
  }
}

function buildPhases(hasGroups: boolean): PhaseDef[] {
  const all: PhaseDef[] = [
    { kind: 'suspense', duration: 3000, dot: 0 },
    { kind: 'groupChampion', duration: 5500, dot: 1 },
    { kind: 'groupPodium', duration: 5500, dot: 2 },
    { kind: 'groupLeaderboard', duration: 9000, dot: 3 },
    { kind: 'participantChampion', duration: 5500, dot: 4 },
    { kind: 'participantPodium', duration: 5500, dot: 5 },
    { kind: 'participantLeaderboard', duration: 9000, dot: 6 },
    { kind: 'groupMissions', duration: 6500, dot: 7 },
    { kind: 'participantMissions', duration: 6500, dot: 8 },
  ]
  return hasGroups ? all : all.filter((p) => !p.kind.startsWith('group'))
}

function ConfettiRain({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 86 }, () => ({
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 1.8}s`,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 5 + Math.random() * 9,
        rotation: Math.random() * 360,
        isCircle: Math.random() > 0.62,
      })),
    [],
  )

  if (!active) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="absolute opacity-0 animate-confetti-fall"
          style={{
            left: p.left,
            top: -20,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            transform: `rotate(${p.rotation}deg)`,
            borderRadius: p.isCircle ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  )
}

function AmbientBackdrop() {
  const orbs = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const colors = ['#FF6B35', '#FF9366', '#FFB800', '#FFD68A', '#50A49D', '#5FB3AA']
        return {
          id: i,
          right: `${-10 + Math.random() * 112}%`,
          top: `${-12 + Math.random() * 118}%`,
          size: `${12 + Math.random() * 18}rem`,
          color: colors[i % colors.length],
          opacity: 0.06 + Math.random() * 0.1,
          delay: `${-(Math.random() * 18).toFixed(2)}s`,
          duration: `${16 + Math.random() * 18}s`,
        }
      }),
    [],
  )
  const sparkles = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        right: `${Math.random() * 96}%`,
        top: `${8 + Math.random() * 84}%`,
        size: 3 + Math.random() * 7,
        delay: `${Math.random() * 7}s`,
        duration: `${4 + Math.random() * 5}s`,
        key: i,
      })),
    [],
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-app-radial" />
      <div className="absolute inset-0 opacity-45 animate-ceremony-wash bg-[linear-gradient(120deg,rgba(255,147,102,0.16),rgba(255,184,0,0.12),rgba(80,164,157,0.14),rgba(255,248,243,0.1))] bg-[length:240%_240%]" />
      {orbs.map((orb) => (
        <span
          key={orb.id}
          className="absolute rounded-full blur-3xl animate-orb-drift"
          style={{
            right: orb.right,
            top: orb.top,
            width: orb.size,
            height: orb.size,
            backgroundColor: orb.color,
            opacity: orb.opacity,
            animationDelay: orb.delay,
            animationDuration: orb.duration,
          }}
        />
      ))}
      <div className="absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.08] animate-light-spin [background:repeating-conic-gradient(from_0deg,transparent_0deg,transparent_9deg,#FFB800_10deg,transparent_13deg)] [mask-image:radial-gradient(circle,black_0%,transparent_68%)]" />
      <div className="absolute inset-y-0 -right-1/3 w-1/3 rotate-12 bg-gradient-to-l from-white/0 via-white/45 to-white/0 blur-sm animate-light-sweep" />
      {sparkles.map((s) => (
        <span
          key={s.key}
          className="absolute rounded-full bg-white shadow-[0_0_16px_rgba(255,184,0,0.55)] animate-sparkle-twinkle"
          style={{ right: s.right, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.duration }}
        />
      ))}
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-l from-[#FF9366] via-[#FFD68A] to-[#5FB3AA]" />
    </div>
  )
}

function StageHeader({
  eventName,
  eventLogoUrl,
  muted,
  onToggleMute,
  fullscreen,
  onToggleFullscreen,
}: {
  eventName?: string
  eventLogoUrl?: string | null
  muted: boolean
  onToggleMute: () => void
  fullscreen: boolean
  onToggleFullscreen: () => void
}) {
  return (
    <header className="relative z-20 flex h-24 items-start justify-between px-6 pt-5 md:px-10">
      <div className="flex items-center gap-3">
        <SoundToggle muted={muted} onToggle={onToggleMute} />
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white/65 text-muted shadow-sm backdrop-blur transition hover:text-primary"
          title={fullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'}
        >
          {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
        </button>
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-3">
          {eventLogoUrl ? (
            <img src={eventLogoUrl} alt={eventName || ''} className="h-14 w-14 rounded-2xl object-cover shadow-[0_0_28px_rgba(255,107,53,0.24)]" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-xl font-black text-primary shadow-[0_0_28px_rgba(255,107,53,0.2)]">
              {(eventName || '🏆').slice(0, 2)}
            </div>
          )}
          <div>
            <p className="text-[13px] font-black uppercase tracking-[0.24em] text-primary">טקס הסיום</p>
            <h1 className="text-3xl font-black text-foreground md:text-4xl">{eventName || 'תוצאות התחרות'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-success/25 bg-white/50 px-3 py-1 text-xs font-black text-success shadow-sm backdrop-blur">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          מתעדכן בזמן אמת
        </div>
      </div>
      <div className="w-10" />
    </header>
  )
}

function SuspensePhase() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.div animate={{ y: [0, -14, 0], rotate: [0, -4, 4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} className="text-[7.5rem] leading-none drop-shadow-[0_0_34px_rgba(255,184,0,0.45)]">
        🏆
      </motion.div>
      <p className="mt-6 text-2xl font-black text-primary">רגע האמת</p>
      <motion.h2
        className="mt-3 text-[clamp(4.4rem,9vw,8.7rem)] font-black leading-[0.95] text-foreground"
        animate={{ scale: [1, 1.03, 1], textShadow: ['0 0 0 rgba(255,184,0,0)', '0 0 34px rgba(255,184,0,0.42)', '0 0 0 rgba(255,184,0,0)'] }}
        transition={{ duration: 1.65, repeat: Infinity, ease: 'easeInOut' }}
      >
        מי יזכה בגביע?
      </motion.h2>
    </div>
  )
}

function ChampionPhase({
  type,
  champ,
  runnerUp,
  group,
}: {
  type: 'group' | 'participant'
  champ?: RankedGroup | RankedParticipant
  runnerUp?: RankedGroup | RankedParticipant
  group?: { id: string; name: string; color: string }
}) {
  if (!champ) return <EmptyPhase title="אין עדיין אלוף להצגה" />

  const isGroup = type === 'group'
  const name = isGroup ? (champ as RankedGroup).group_name : (champ as RankedParticipant).participant_name
  const color = isGroup ? (champ as RankedGroup).group_color || GOLD : group?.color || TEAL
  const gap = runnerUp ? Math.max(0, champ.total_points - runnerUp.total_points) : champ.total_points
  const themeColor = isGroup ? GOLD : TEAL

  return (
    <div className="relative flex h-full items-center justify-center px-5">
      <div
        className="absolute inset-x-0 top-0 mx-auto h-[70%] max-w-[70rem] opacity-30 blur-3xl"
        style={{ background: `radial-gradient(ellipse at center, ${themeColor} 0%, transparent 62%)` }}
      />
      <motion.div
        className={cn(
          'relative w-full max-w-5xl overflow-hidden rounded-[2rem] border-2 p-8 text-center shadow-[0_28px_90px_rgba(46,34,30,0.18)] md:p-12',
          isGroup ? 'border-warning/70 bg-[linear-gradient(150deg,#FFFDF7,#FFF1D2)]' : 'border-secondary/55 bg-[linear-gradient(150deg,#FFFDF7,#EAF7F5)]',
        )}
        initial={{ opacity: 0, scale: 0.72, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute -inset-16 animate-halo-pulse rounded-full" style={{ background: `radial-gradient(circle, ${themeColor}35 0%, transparent 64%)` }} />
        <div className="absolute inset-y-0 -right-1/3 w-1/3 rotate-12 bg-gradient-to-l from-transparent via-white/75 to-transparent animate-light-sweep" />
        <div className="relative">
          <motion.div className="mx-auto mb-2 w-fit text-6xl" animate={{ rotate: [0, -8, 8, 0], y: [0, -5, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>
            👑
          </motion.div>
          <p className="text-2xl font-black text-primary">{isGroup ? '🏆 אליפות המשפחות' : 'אלוף המשתתפים'}</p>
          <div className="mx-auto mt-5 flex h-32 w-32 items-center justify-center rounded-full border-[8px] border-white text-5xl font-black text-white shadow-[0_16px_46px_rgba(46,34,30,0.2)] md:h-40 md:w-40 md:text-6xl" style={{ background: `linear-gradient(135deg, ${color}, ${isGroup ? ORANGE : GOLD})` }}>
            {isGroup ? <Users size={72} /> : <AvatarCircle name={name} size="lg" ringColor={color} className="h-32 w-32 text-5xl ring-0 md:h-40 md:w-40 md:text-6xl" />}
          </div>
          <p className="mt-5 text-xl font-black text-muted">{isGroup ? 'המשפחה המנצחת' : group?.name || 'המשתתף המנצח'}</p>
          <h2 className="mx-auto mt-2 max-w-[14ch] truncate text-[clamp(4.2rem,8.5vw,7.25rem)] font-black leading-none text-foreground">{name}</h2>
          <div className="mt-4 text-[clamp(5rem,10vw,8.5rem)] font-black leading-none tabular-nums animate-number-glow" style={{ color: themeColor }}>
            <AnimatedNumber value={champ.total_points} duration={2500} />
          </div>
          <p className="text-3xl font-black text-muted">נקודות</p>
          <div className="mx-auto mt-6 inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/70 px-7 py-3 text-2xl font-black text-foreground shadow-lg backdrop-blur">
            <span>🥇 מקום ראשון</span>
            <span className="h-7 w-px bg-border" />
            <span>{isGroup ? `הפרש של ${gap.toLocaleString('he-IL')} נק׳ בלבד` : 'שוברת שיאים!'}</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function PodiumPhase({ title, items, type }: { title: string; items: (RankedGroup | RankedParticipant | undefined)[]; type: 'group' | 'participant' }) {
  const ordered = [items[1], items[0], items[2]].filter(Boolean) as (RankedGroup | RankedParticipant)[]
  if (ordered.length === 0) return <EmptyPhase title="אין עדיין זוכים להצגה" />

  return (
    <div className="flex h-full flex-col items-center justify-center px-5">
      <p className="text-2xl font-black text-primary">פודיום המנצחים</p>
      <h2 className="mb-10 text-center text-[clamp(3.5rem,6vw,6.2rem)] font-black leading-none text-foreground">{title}</h2>
      <div className="flex w-full max-w-6xl items-end justify-center gap-4 md:gap-8">
        {ordered.map((item, idx) => {
          const isGroup = 'group_name' in item
          const rank = item.rank
          const name = isGroup ? item.group_name : item.participant_name
          const color = isGroup ? item.group_color : type === 'participant' ? TEAL : GOLD
          const heights: Record<number, string> = { 1: 'h-[300px]', 2: 'h-[212px]', 3: 'h-[168px]' }
          const width = rank === 1 ? 'w-[32%]' : 'w-[26%]'
          return (
            <motion.div
              key={isGroup ? item.group_id : item.participant_id}
              className={cn('flex min-w-0 flex-col items-center', width)}
              initial={{ opacity: 0, y: 34, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: rank === 1 ? 0.05 : 0.22 + idx * 0.1, type: 'spring', stiffness: 180, damping: 18 }}
            >
              {rank === 1 && <Crown size={52} className="mb-2 animate-crown-glow text-warning" fill="currentColor" />}
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-white text-3xl font-black text-white shadow-xl md:h-32 md:w-32" style={{ background: `linear-gradient(135deg, ${color}, ${rank === 1 ? GOLD : ORANGE})` }}>
                  {isGroup ? <Users size={50} /> : <AvatarCircle name={name} size="lg" ringColor={color} className="h-24 w-24 text-3xl ring-0 md:h-32 md:w-32 md:text-4xl" />}
                </div>
                <span className="absolute -bottom-2 -right-2 flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl shadow-lg">{MEDALS[rank - 1] || rank}</span>
              </div>
              <h3 className="mt-5 w-full truncate text-center text-3xl font-black text-foreground md:text-4xl">{name}</h3>
              <p className="mt-1 text-2xl font-black text-primary tabular-nums">{item.total_points.toLocaleString('he-IL')} נק׳</p>
              <motion.div
                className={cn('mt-5 flex w-full origin-bottom items-end justify-center rounded-t-[1.75rem] shadow-[0_16px_44px_rgba(46,34,30,0.16)]', heights[rank])}
                style={{ background: rank === 1 ? 'linear-gradient(180deg,#FFD68A,#FFB800)' : rank === 2 ? 'linear-gradient(180deg,#F5F2EE,#B9AEA7)' : 'linear-gradient(180deg,#FFB28D,#EF8A4E)' }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.25 + idx * 0.08, duration: 0.7, ease: 'easeOut' }}
              >
                <span className="mb-8 text-[5rem] font-black leading-none text-white/95 drop-shadow">{rank}</span>
              </motion.div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-black shadow-lg"
      style={{
        background: rank === 1 ? GOLD : rank === 2 ? '#D9D2CB' : rank === 3 ? WARM_ORANGE : 'white',
        color: rank <= 3 ? 'white' : INK,
      }}
    >
      {rank <= 3 ? MEDALS[rank - 1] : rank}
    </div>
  )
}

function LeaderboardPhase({
  title,
  subtitle,
  items,
  type,
  pgMap,
  taskCountByP,
  groupTaskCounts,
  topPByGroup,
}: {
  title: string
  subtitle: string
  items: (RankedGroup | RankedParticipant)[]
  type: 'group' | 'participant'
  pgMap: Map<string, { id: string; name: string; color: string }>
  taskCountByP: Map<string, number>
  groupTaskCounts: Map<string, number>
  topPByGroup: Map<string, { name: string }>
}) {
  const visible = items.filter((item) => item.total_points > 0).slice(0, 8)
  const topPoints = Math.max(1, visible[0]?.total_points || 1)

  if (visible.length === 0) return <EmptyPhase title="אין עדיין ניקוד להצגה" />

  return (
    <div className="flex h-full flex-col px-5 py-1 md:px-10">
      <div className="mb-7 flex items-end justify-between gap-5">
        <div>
          <p className="text-2xl font-black text-primary">{subtitle}</p>
          <h2 className="text-[clamp(3.5rem,6vw,6rem)] font-black leading-none text-foreground">{title}</h2>
        </div>
        <div className="mb-3 rounded-full border border-success/25 bg-white/65 px-5 py-2 text-lg font-black text-success shadow-sm">מתעדכן בזמן אמת</div>
      </div>
      <div className="grid flex-1 content-start gap-3">
        {visible.map((item, idx) => {
          const isGroup = 'group_name' in item
          const name = isGroup ? item.group_name : item.participant_name
          const id = isGroup ? item.group_id : item.participant_id
          const group = !isGroup ? pgMap.get(item.participant_id) : undefined
          const color = isGroup ? item.group_color : group?.color || TEAL
          const missions = isGroup ? groupTaskCounts.get(item.group_id) || 0 : taskCountByP.get(item.participant_id) || 0
          const leader = isGroup ? topPByGroup.get(item.group_id)?.name : group?.name
          const pct = Math.max(4, Math.round((item.total_points / topPoints) * 100))

          return (
            <motion.div
              key={id}
              className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border bg-white/78 px-5 py-4 shadow-[0_8px_28px_rgba(46,34,30,0.08)] backdrop-blur"
              style={{
                borderColor: item.rank === 1 ? `${GOLD}AA` : item.rank === 2 ? '#B9AEA7AA' : item.rank === 3 ? `${WARM_ORANGE}99` : 'rgba(231,214,207,0.82)',
                borderInlineStartWidth: item.rank <= 3 ? 8 : 1,
                background: item.rank === 1 ? 'linear-gradient(90deg,rgba(255,184,0,0.16),rgba(255,255,255,0.78))' : undefined,
              }}
              initial={{ opacity: 0, x: 34 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.45 }}
            >
              <RankBadge rank={item.rank} />
              {isGroup ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: color }}>
                  <Users size={34} />
                </div>
              ) : (
                <AvatarCircle name={name} size="lg" ringColor={color} className="h-16 w-16 text-2xl" />
              )}
              <div className="min-w-0">
                <div className="mb-2 flex items-baseline gap-3">
                  <h3 className="truncate text-3xl font-black text-foreground">{name}</h3>
                  <span className="shrink-0 text-lg font-bold text-muted">{isGroup ? `${missions} משימות` : leader || 'ללא קבוצה'}</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-[#F3E4DD]">
                  <motion.div
                    className="h-full origin-right rounded-full"
                    style={{ background: `linear-gradient(90deg, ${type === 'group' ? ORANGE : GOLD}, ${type === 'group' ? GOLD : TEAL})` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: pct / 100 }}
                    transition={{ delay: 0.15 + idx * 0.08, duration: 0.85, ease: 'easeOut' }}
                  />
                </div>
              </div>
              <div className="text-left">
                <p className={cn('text-4xl font-black tabular-nums', item.rank === 1 ? 'text-warning' : 'text-foreground')}>{item.total_points.toLocaleString('he-IL')}</p>
                <p className="text-lg font-bold text-muted">נקודות</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function MissionsPhase({ type, winners }: { type: 'group' | 'participant'; winners: MissionWinner[] }) {
  if (winners.length === 0) return <EmptyPhase title="אין עדיין משימות שהושלמו" />
  const ordered = [winners[1], winners[0], winners[2]].filter(Boolean) as MissionWinner[]

  return (
    <div className="flex h-full flex-col items-center justify-center px-5">
      <p className="text-2xl font-black text-primary">🎯 אלופי ההתמדה</p>
      <h2 className="mt-2 max-w-5xl text-center text-[clamp(3.5rem,6vw,6rem)] font-black leading-none text-foreground">
        {type === 'group' ? 'המשפחות שהשלימו הכי הרבה משימות' : 'המשתתפים שהשלימו הכי הרבה משימות'}
      </h2>
      <p className="mt-4 text-2xl font-bold text-muted">כי לא רק נקודות - גם ההשקעה נספרת</p>
      <div className="mt-10 grid w-full max-w-6xl grid-cols-3 gap-5">
        {ordered.map((winner, idx) => {
          const rank = winners.findIndex((w) => w.id === winner.id) + 1
          return (
            <motion.div
              key={winner.id}
              className={cn('relative overflow-hidden rounded-[1.75rem] border bg-white/78 p-7 text-center shadow-[0_18px_54px_rgba(46,34,30,0.12)] backdrop-blur', rank === 1 ? 'min-h-[26rem] border-warning/70' : 'mt-12 min-h-[22rem] border-border')}
              initial={{ opacity: 0, y: 28, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: idx * 0.12, type: 'spring', stiffness: 170, damping: 18 }}
            >
              <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 0%, ${rank === 1 ? GOLD : type === 'group' ? TEAL : ORANGE}, transparent 58%)` }} />
              <div className="relative">
                {rank === 1 && <div className="mb-2 text-5xl">👑</div>}
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-white bg-gradient-to-br from-[#FF9366] to-[#FFB800] text-5xl shadow-xl">🎯</div>
                <div className="mt-5 inline-flex rounded-full bg-[#FFF1D2] px-4 py-2 text-lg font-black text-primary">
                  {rank === 1 ? '🎯 אלופת המשימות' : MEDALS[rank - 1] || `#${rank}`}
                </div>
                <h3 className="mt-5 truncate text-4xl font-black text-foreground">{winner.name}</h3>
                <p className="mt-5 text-[6rem] font-black leading-none tabular-nums text-secondary">{winner.count.toLocaleString('he-IL')}</p>
                <p className="text-2xl font-black text-muted">משימות הושלמו</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyPhase({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <div className="rounded-[1.75rem] border border-border bg-white/70 px-12 py-10 shadow-card backdrop-blur">
        <Trophy size={52} className="mx-auto mb-4 text-warning" />
        <p className="text-4xl font-black text-foreground">{title}</p>
      </div>
    </div>
  )
}

function ProgressChrome({ activeDot, onReplay }: { activeDot: number; onReplay: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-5 px-6 pb-6">
      <button onClick={onReplay} className="flex items-center gap-2 rounded-full border border-border bg-white/65 px-4 py-2 text-sm font-black text-muted shadow-sm backdrop-blur transition hover:text-primary">
        <RotateCcw size={15} />
        הצג שוב
      </button>
      <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-4 py-3 shadow-sm backdrop-blur">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={cn('h-2.5 rounded-full transition-all duration-500', activeDot === i ? 'w-11 bg-primary' : 'w-2.5 bg-primary/25')} />
        ))}
      </div>
    </div>
  )
}

export function WinnersCeremony({ eventId, eventName, eventLogoUrl }: WinnersCeremonyProps) {
  const { rankedP, rankedG, hasGroups, taskCountByP, groupTaskCounts, topPByGroup, taskStats, pgMap, loading, error } = useLeaderboardData(eventId)
  const { play, playApplause, muted, toggleMute } = useSound()
  const { play: playFanfare } = useCelebrationSound()
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [replayNonce, setReplayNonce] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const applausePhaseRef = useRef<string | null>(null)
  const stageScale = useCeremonyScale()

  const revealSpeed = DEFAULT_REVEAL_SPEED
  const autoLoop = AUTO_LOOP
  const phases = useMemo(() => buildPhases(hasGroups), [hasGroups])
  const phase = phases[Math.min(phaseIndex, phases.length - 1)] || phases[0]
  const isChampionPhase = phase?.kind === 'groupChampion' || phase?.kind === 'participantChampion'

  useEffect(() => {
    setPhaseIndex(0)
    setReplayNonce((n) => n + 1)
    applausePhaseRef.current = null
  }, [hasGroups, eventId])

  useEffect(() => {
    if (loading || error || rankedP.length === 0 || !phase || phases.length === 0) return undefined
    const timer = window.setTimeout(() => {
      setPhaseIndex((idx) => {
        const next = idx + 1
        if (next < phases.length) return next
        return autoLoop ? 0 : idx
      })
    }, phase.duration / revealSpeed)
    return () => window.clearTimeout(timer)
  }, [autoLoop, error, loading, phase, phases.length, rankedP.length, replayNonce, revealSpeed])

  useEffect(() => {
    function handleFullscreenChange() {
      setFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!phase || !isChampionPhase || applausePhaseRef.current === phase.kind) return undefined
    applausePhaseRef.current = phase.kind
    const timer = window.setTimeout(() => {
      playApplause(1)
      if (!muted) playFanfare()
    }, 200)
    return () => window.clearTimeout(timer)
  }, [isChampionPhase, muted, phase, playApplause, playFanfare])

  function handleSoundToggle() {
    toggleMute()
    if (muted) play()
  }

  function handleToggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        stageRef.current?.requestFullscreen()
      }
    } catch {
      // Fullscreen can be blocked by browser policy; display mode still works.
    }
  }

  function handleReplay() {
    applausePhaseRef.current = null
    setPhaseIndex(0)
    setReplayNonce((n) => n + 1)
  }

  const champGroup = rankedG[0]
  const champParticipant = rankedP[0]
  const groupRunnerUp = rankedG.find((g) => g.rank === 2)
  const participantRunnerUp = rankedP.find((p) => p.rank === 2)
  const participantGroup = champParticipant ? pgMap.get(champParticipant.participant_id) : undefined
  const groupMissionWinners = useMemo(
    () =>
      rankedG
        .map((g) => ({ id: g.group_id, name: g.group_name, count: groupTaskCounts.get(g.group_id) || 0, color: g.group_color }))
        .filter((g) => g.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
    [groupTaskCounts, rankedG],
  )
  const participantMissionWinners = useMemo(
    () =>
      rankedP
        .map((p) => ({ id: p.participant_id, name: p.participant_name, count: taskCountByP.get(p.participant_id) || 0, color: pgMap.get(p.participant_id)?.color }))
        .filter((p) => p.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
    [pgMap, rankedP, taskCountByP],
  )

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-app-radial" dir="rtl">
        <AmbientBackdrop />
        <CenteredLoader className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-4">
          <Spinner size="lg" className="border-warning" />
          <p className="text-2xl font-black text-foreground">טוענים את התוצאות</p>
        </CenteredLoader>
      </div>
    )
  }

  if (error) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app-radial p-6" dir="rtl">
        <AmbientBackdrop />
        <ErrorAlert message={`שגיאה בטעינת הנתונים - ${error}`} className="relative z-10 max-w-xl bg-white/80 text-lg shadow-card backdrop-blur" />
      </div>
    )
  }

  if (rankedP.length === 0 && rankedG.length === 0) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app-radial p-6" dir="rtl">
        <AmbientBackdrop />
        <div className="relative z-10 rounded-[1.75rem] border border-border bg-white/72 p-8 shadow-[0_18px_54px_rgba(46,34,30,0.12)] backdrop-blur">
          <LeaderboardEmptyState />
        </div>
      </div>
    )
  }

  return (
    <div ref={stageRef} className="relative h-screen w-screen overflow-hidden bg-app-radial font-sans text-foreground" dir="rtl">
      <AmbientBackdrop />
      <ConfettiRain active={isChampionPhase} />
      <div
        className="absolute left-1/2 top-1/2 h-[1080px] w-[1920px] origin-center overflow-hidden"
        style={{ transform: `translate(-50%, -50%) scale(${stageScale})` }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-[1080px] w-[1920px] origin-center"
          style={{ transform: `translate(-50%, -50%) scale(${CONTENT_SCALE})` }}
        >
          <StageHeader eventName={eventName} eventLogoUrl={eventLogoUrl} muted={muted} onToggleMute={handleSoundToggle} fullscreen={fullscreen} onToggleFullscreen={handleToggleFullscreen} />
          <main className="relative z-10 h-[928px] px-2 pb-16">
            <AnimatePresence mode="wait">
              <motion.section
                key={phase.kind}
                className="h-full"
                initial={{ opacity: 0, scale: isChampionPhase ? 0.94 : 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.015 }}
                transition={{ duration: 0.7, ease: 'easeInOut' }}
              >
                {phase.kind === 'suspense' && <SuspensePhase />}
                {phase.kind === 'groupChampion' && <ChampionPhase type="group" champ={champGroup} runnerUp={groupRunnerUp} />}
                {phase.kind === 'groupPodium' && <PodiumPhase title="שלוש המשפחות המובילות" type="group" items={[champGroup, groupRunnerUp, rankedG.find((g) => g.rank === 3)]} />}
                {phase.kind === 'groupLeaderboard' && (
                  <LeaderboardPhase title="טבלת המשפחות" subtitle="דירוג מלא" type="group" items={rankedG} pgMap={pgMap} taskCountByP={taskCountByP} groupTaskCounts={groupTaskCounts} topPByGroup={topPByGroup} />
                )}
                {phase.kind === 'participantChampion' && <ChampionPhase type="participant" champ={champParticipant} runnerUp={participantRunnerUp} group={participantGroup} />}
                {phase.kind === 'participantPodium' && <PodiumPhase title="שלושת המשתתפים המובילים" type="participant" items={[champParticipant, participantRunnerUp, rankedP.find((p) => p.rank === 3)]} />}
                {phase.kind === 'participantLeaderboard' && (
                  <LeaderboardPhase title="טבלת המשתתפים" subtitle="דירוג מלא" type="participant" items={rankedP} pgMap={pgMap} taskCountByP={taskCountByP} groupTaskCounts={groupTaskCounts} topPByGroup={topPByGroup} />
                )}
                {phase.kind === 'groupMissions' && <MissionsPhase type="group" winners={groupMissionWinners} />}
                {phase.kind === 'participantMissions' && <MissionsPhase type="participant" winners={participantMissionWinners} />}
              </motion.section>
            </AnimatePresence>
          </main>
          <ProgressChrome
            activeDot={phase.dot}
            onReplay={handleReplay}
          />
          <span className="sr-only">{taskStats.length} סוגי משימות נספרו</span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-[#FFF8F3] to-transparent" />
    </div>
  )
}
