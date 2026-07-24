import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, ClipboardCheck, Crown, Gift, Minimize2, Pause, Play, RotateCcw, ScanLine, Sparkles, Trophy, Users, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { computeRanks } from '@/lib/missionUtils'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/useSound'
import { useCelebrationSound } from '@/hooks/useCelebrationSound'
import { calculateCeremonyReadiness, CEREMONY_MIN_PARTICIPANTS } from '@/lib/ceremonyReadiness'
import { LeaderboardEmptyState } from './LeaderboardEmptyState'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Spinner } from '@/components/ui/Spinner'
import { ScreenControlsExtra, screenControlClass } from '@/components/ui/ScreenControls'
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

interface ParticipantGroupRef {
  id: string
  name: string
  color: string
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
  | 'finalSummary'

interface PhaseDef {
  kind: PhaseKind
  duration: number
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

function getParticipantGroupSummary(groups: ParticipantGroupRef[], totalGroups?: number) {
  if (groups.length === 0) return 'ללא קבוצה'
  if (typeof totalGroups === 'number' && totalGroups > 0 && groups.length >= totalGroups) return 'כל הקבוצות'
  return groups.length === 1 ? 'קבוצה אחת' : `${groups.length} קבוצות`
}

function ParticipantGroupChips({
  groups,
  compact = false,
  totalGroups,
}: {
  groups: ParticipantGroupRef[]
  compact?: boolean
  totalGroups?: number
}) {
  if (groups.length === 0) {
    return <span className={cn('font-bold text-[#9A8E88]', compact ? 'text-sm' : 'text-base')}>ללא קבוצה</span>
  }

  if (typeof totalGroups === 'number' && totalGroups > 0 && groups.length >= totalGroups) {
    return <span className={cn('font-bold text-[#9A8E88]', compact ? 'text-sm' : 'text-base')}>כל הקבוצות</span>
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', compact ? 'text-xs' : 'text-sm')}>
      {groups.map((group) => (
        <span
          key={group.id}
          className="inline-flex max-w-full items-center rounded-full border px-2.5 py-1 font-black leading-none"
          style={{
            color: group.color,
            borderColor: `${group.color}66`,
            background: `${group.color}14`,
          }}
        >
          <span className="truncate">{group.name}</span>
        </span>
      ))}
    </div>
  )
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
  const [pgMap, setPgMap] = useState<Map<string, ParticipantGroupRef[]>>(new Map())
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [totalScans, setTotalScans] = useState(0)
  const [totalRewardsAwarded, setTotalRewardsAwarded] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const [pRes, gRes, txRes, participantsRes, scansRes, rewardsRes] = await Promise.all([
        supabase.rpc('get_participant_leaderboard', { p_event_id: eventId }),
        supabase.rpc('get_group_leaderboard', { p_event_id: eventId }),
        supabase
          .from('point_transactions')
          .select('id, participant_id, action_id, points, created_at, participant:participants(name, external_id), action:actions(name, code)')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('participants').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('point_transactions').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('participant_rewards').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
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
      setTotalParticipants(participantsRes.count ?? pData.length)
      setTotalScans(scansRes.count ?? (txRes.data ?? []).length)
      setTotalRewardsAwarded(rewardsRes.count ?? 0)

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
        const map = new Map<string, ParticipantGroupRef[]>()
        for (const m of allPg) {
          if (!m.groups) continue
          const existing = map.get(m.participant_id) ?? []
          const next = [...existing, m.groups]
          next.sort((a, b) => a.name.localeCompare(b.name, 'he'))
          map.set(m.participant_id, next)
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
  const totalGroupCount = groupData.length
  const taskCountByP = useMemo(() => {
    const m = new Map<string, number>()
    for (const tx of transactions) m.set(tx.participant_id, (m.get(tx.participant_id) || 0) + 1)
    return m
  }, [transactions])
  const groupTaskCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const [pid, c] of taskCountByP) {
      const groups = pgMap.get(pid) ?? []
      for (const g of groups) {
        m.set(g.id, (m.get(g.id) || 0) + c)
      }
    }
    return m
  }, [taskCountByP, pgMap])
  const txByParticipant = useMemo(() => {
    const m = new Map<string, TxRow[]>()
    for (const tx of transactions) {
      const arr = m.get(tx.participant_id)
      if (arr) arr.push(tx)
      else m.set(tx.participant_id, [tx])
    }
    return m
  }, [transactions])
  const txByGroup = useMemo(() => {
    const m = new Map<string, TxRow[]>()
    for (const tx of transactions) {
      const groups = pgMap.get(tx.participant_id) ?? []
      for (const g of groups) {
        const arr = m.get(g.id)
        if (arr) arr.push(tx)
        else m.set(g.id, [tx])
      }
    }
    return m
  }, [transactions, pgMap])
  const topPByGroup = useMemo(() => {
    const m = new Map<string, { name: string }>()
    for (const p of rankedP) {
      const groups = pgMap.get(p.participant_id) ?? []
      for (const g of groups) {
        if (!m.has(g.id)) m.set(g.id, { name: p.participant_name })
      }
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
  const participatingParticipants = useMemo(() => new Set(transactions.map((tx) => tx.participant_id)).size, [transactions])
  const totalPointsEarned = useMemo(() => transactions.reduce((sum, tx) => sum + (tx.points || 0), 0), [transactions])
  const ceremonyReadiness = useMemo(
    () => calculateCeremonyReadiness(totalParticipants, participatingParticipants, CEREMONY_MIN_PARTICIPANTS),
    [participatingParticipants, totalParticipants],
  )

  return {
    rankedP,
    rankedG,
    hasGroups,
    totalGroupCount,
    taskCountByP,
    groupTaskCounts,
    txByParticipant,
    txByGroup,
    topPByGroup,
    taskStats,
    pgMap,
    totalParticipants,
    totalScans,
    totalRewardsAwarded,
    totalPointsEarned,
    participatingParticipants,
    ceremonyReadiness,
    loading,
    error,
  }
}

function buildPhases(hasGroups: boolean): PhaseDef[] {
  const all: PhaseDef[] = [
    { kind: 'suspense', duration: 3000 },
    { kind: 'groupChampion', duration: 5500 },
    { kind: 'groupPodium', duration: 5500 },
    { kind: 'groupLeaderboard', duration: 9000 },
    { kind: 'participantChampion', duration: 5500 },
    { kind: 'participantPodium', duration: 5500 },
    { kind: 'participantLeaderboard', duration: 9000 },
    { kind: 'groupMissions', duration: 6500 },
    { kind: 'participantMissions', duration: 6500 },
    { kind: 'finalSummary', duration: 12000 },
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

/** Height the stage reserves for {@link StageHeader}, so main can fill the rest. */
const HEADER_HEIGHT = 184

function StageHeader({
  eventName,
  eventLogoUrl,
}: {
  eventName?: string
  eventLogoUrl?: string | null
}) {
  // Fullscreen / sound now live in the viewport-level ScreenControls toolbar,
  // not in this scaled header - so it only carries the event branding. The logo
  // and the resort name are the room's anchor for the whole ceremony, so they
  // sit bare on the backdrop at full size: no card, no border, nothing that
  // reads as chrome around them.
  return (
    <header className="relative z-20 flex items-center justify-center px-6 pt-4 md:px-10" style={{ height: HEADER_HEIGHT }}>
      <motion.div
        className="pointer-events-none flex items-center gap-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="relative shrink-0"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="absolute inset-[-22px] rounded-full bg-[#FFB800]/25 blur-3xl" />
          {eventLogoUrl ? (
            <img
              src={eventLogoUrl}
              alt={eventName || ''}
              className="relative h-36 w-auto max-w-[420px] rounded-[34px] object-contain drop-shadow-[0_16px_34px_rgba(46,34,30,0.24)]"
            />
          ) : (
            /* No uploaded logo - a crown reads as the ceremony, initials read
               as a typo. */
            <div className="relative flex h-36 w-36 items-center justify-center rounded-[34px] bg-[linear-gradient(135deg,#FFF1D2,#FFB84D)] text-[#2E221E] drop-shadow-[0_16px_34px_rgba(46,34,30,0.24)]">
              <Crown size={68} strokeWidth={2} fill="currentColor" className="opacity-90" />
            </div>
          )}
        </motion.div>

        <div className="min-w-0 text-right">
          <p className="text-[52px] font-black leading-none tracking-[-0.01em] text-[#EF8A4E]">טקס הסיום</p>
          {/* Capped so an unusually long resort name truncates instead of
              running off the stage. */}
          <h1 className="mt-2 max-w-[1150px] truncate text-[72px] font-black leading-[1.05] text-[#2E221E] [text-shadow:0_3px_24px_rgba(255,184,0,0.3)]">
            {eventName || 'תוצאות התחרות'}
          </h1>
        </div>
      </motion.div>
    </header>
  )
}

function SuspensePhase() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <motion.div animate={{ y: [0, -14, 0], rotate: [0, -4, 4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} className="text-[7.5rem] leading-none drop-shadow-[0_0_34px_rgba(255,184,0,0.45)]">
        🏆
      </motion.div>
      <p className="mt-6 text-2xl font-black text-primary-text">רגע האמת</p>
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
  groups,
  totalGroups,
}: {
  type: 'group' | 'participant'
  champ?: RankedGroup | RankedParticipant
  runnerUp?: RankedGroup | RankedParticipant
  groups?: ParticipantGroupRef[]
  totalGroups?: number
}) {
  if (!champ) return <EmptyPhase title="אין עדיין אלוף להצגה" />

  const isGroup = type === 'group'
  const name = isGroup ? (champ as RankedGroup).group_name : (champ as RankedParticipant).participant_name
  const participantGroups = isGroup ? [] : groups ?? []
  const color = isGroup ? (champ as RankedGroup).group_color || GOLD : participantGroups[0]?.color || TEAL
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
          <p className="text-2xl font-black text-primary-text">{isGroup ? '🏆 אליפות הקבוצות' : 'אלוף המשתתפים'}</p>
          <div className="mx-auto mt-5 flex h-32 w-32 items-center justify-center rounded-full border-[8px] border-white text-5xl font-black text-white shadow-[0_16px_46px_rgba(46,34,30,0.2)] md:h-40 md:w-40 md:text-6xl" style={{ background: `linear-gradient(135deg, ${color}, ${isGroup ? ORANGE : GOLD})` }}>
            {isGroup ? <Users size={72} /> : <AvatarCircle name={name} size="lg" ringColor={color} className="h-32 w-32 text-5xl ring-0 md:h-40 md:w-40 md:text-6xl" />}
          </div>
          <p className="mt-5 text-xl font-black text-muted">{isGroup ? 'הקבוצה המנצחת' : getParticipantGroupSummary(participantGroups, totalGroups)}</p>
          <h2 className="mx-auto mt-2 max-w-[14ch] truncate text-[clamp(4.2rem,8.5vw,7.25rem)] font-black leading-none text-foreground">{name}</h2>
          {!isGroup && (
            <div className="mx-auto mt-4 flex max-w-4xl justify-center">
              <ParticipantGroupChips groups={participantGroups} compact={false} totalGroups={totalGroups} />
            </div>
          )}
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
  const colCount = ordered.length

  return (
    <div className="flex h-full flex-col items-center justify-center px-5">
      <p className="text-2xl font-black text-primary-text">פודיום המנצחים</p>
      <h2 className="mb-10 text-center text-[clamp(3.5rem,6vw,6.2rem)] font-black leading-none text-foreground">{title}</h2>
      <div
        className={cn(
          'mx-auto grid w-full items-end justify-items-center gap-4 md:gap-8',
          colCount === 1 ? 'max-w-md grid-cols-1' : colCount === 2 ? 'max-w-4xl grid-cols-2' : 'max-w-6xl grid-cols-3',
        )}
      >
        {ordered.map((item, idx) => {
          const isGroup = 'group_name' in item
          const rank = item.rank
          const name = isGroup ? item.group_name : item.participant_name
          const color = isGroup ? item.group_color : type === 'participant' ? TEAL : GOLD
          const heights: Record<number, string> = { 1: 'h-[300px]', 2: 'h-[212px]', 3: 'h-[168px]' }
          return (
            <motion.div
              key={isGroup ? item.group_id : item.participant_id}
              className="flex w-full min-w-0 flex-col items-center"
              initial={{ opacity: 0, y: 34, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: rank === 1 ? 0.05 : 0.22 + idx * 0.1, type: 'spring', stiffness: 180, damping: 18 }}
            >
              {rank === 1 && <Crown size={52} className="mb-2 animate-crown-glow text-warning-text" fill="currentColor" />}
              <div className="relative">
                <div
                  className="absolute -inset-5 animate-halo-pulse rounded-full blur-xl"
                  style={{ background: `radial-gradient(circle, ${rank === 1 ? GOLD : color} 0%, transparent 70%)` }}
                />
                <div
                  className={cn(
                    'relative z-10 flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-white text-3xl font-black text-white md:h-32 md:w-32',
                    rank === 1 ? 'animate-glow-pulse-gold' : 'animate-glow-pulse',
                  )}
                  style={{ background: `linear-gradient(135deg, ${color}, ${rank === 1 ? GOLD : ORANGE})` }}
                >
                  {isGroup ? <Users size={50} /> : <AvatarCircle name={name} size="lg" ringColor={color} className="h-24 w-24 text-3xl ring-0 md:h-32 md:w-32 md:text-4xl" />}
                </div>
                <span className="absolute -bottom-2 -right-2 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl shadow-lg">{MEDALS[rank - 1] || rank}</span>
              </div>
              <h3 className="mt-5 w-full truncate text-center text-3xl font-black text-foreground md:text-4xl">{name}</h3>
              <p className="mt-1 text-2xl font-black text-primary-text tabular-nums">{item.total_points.toLocaleString('he-IL')} נק׳</p>
              <motion.div
                className={cn('relative mt-5 flex w-full origin-bottom items-end justify-center overflow-hidden rounded-t-[1.75rem] shadow-[0_16px_44px_rgba(46,34,30,0.16)]', heights[rank])}
                style={{ background: rank === 1 ? 'linear-gradient(180deg,#FFD68A,#FFB800)' : rank === 2 ? 'linear-gradient(180deg,#F5F2EE,#B9AEA7)' : 'linear-gradient(180deg,#FFB28D,#EF8A4E)' }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.25 + idx * 0.08, duration: 0.7, ease: 'easeOut' }}
              >
                <div
                  className="pointer-events-none absolute inset-y-0 -right-1/2 w-2/5 rotate-12 bg-gradient-to-l from-transparent via-white/90 to-transparent blur-[3px] animate-podium-shine"
                  style={{ animationDelay: `${idx * 0.45}s` }}
                />
                <span className="relative mb-8 text-[5rem] font-black leading-none text-white/95 drop-shadow">{rank}</span>
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
  totalGroups,
  taskCountByP,
  groupTaskCounts,
  topPByGroup,
}: {
  title: string
  subtitle: string
  items: (RankedGroup | RankedParticipant)[]
  type: 'group' | 'participant'
  pgMap: Map<string, ParticipantGroupRef[]>
  totalGroups?: number
  taskCountByP: Map<string, number>
  groupTaskCounts: Map<string, number>
  topPByGroup: Map<string, { name: string }>
}) {
  const visible = items.filter((item) => item.total_points > 0).slice(0, 8)
  const topPoints = Math.max(1, visible[0]?.total_points || 1)
  void topPByGroup

  if (visible.length === 0) return <EmptyPhase title="אין עדיין ניקוד להצגה" />

  return (
    <div className="flex h-full flex-col px-5 py-1 md:px-10">
      <div className="mb-7 flex items-end justify-between gap-5">
        <div>
          <p className="text-2xl font-black text-primary-text">{subtitle}</p>
          <h2 className="text-[clamp(3.5rem,6vw,6rem)] font-black leading-none text-foreground">{title}</h2>
        </div>
      </div>
      <div className="grid flex-1 content-start gap-3">
        {visible.map((item, idx) => {
          const isGroup = 'group_name' in item
          const name = isGroup ? item.group_name : item.participant_name
          const id = isGroup ? item.group_id : item.participant_id
          const groups = isGroup ? [] : pgMap.get(item.participant_id) ?? []
          const color = isGroup ? item.group_color : groups[0]?.color || TEAL
          const missions = isGroup ? groupTaskCounts.get(item.group_id) || 0 : taskCountByP.get(item.participant_id) || 0
          const pct = Math.max(4, Math.round((item.total_points / topPoints) * 100))

          return (
            <motion.div
              key={id}
              className={cn(
                'grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border bg-white/78 px-5 py-4 shadow-[0_8px_28px_rgba(46,34,30,0.08)] backdrop-blur',
                item.rank <= 3 && 'top-rank-row',
                item.rank === 1 && 'top-rank-1',
                item.rank === 2 && 'top-rank-2',
                item.rank === 3 && 'top-rank-3',
              )}
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
                  <span className="shrink-0 text-lg font-bold text-muted">{isGroup ? `${missions} משימות` : getParticipantGroupSummary(groups, totalGroups)}</span>
                </div>
                {!isGroup ? (
                  <div className="max-w-full">
                    <ParticipantGroupChips groups={groups} compact totalGroups={totalGroups} />
                  </div>
                ) : (
                  <div className="h-0.5" />
                )}
                <div className={cn('h-4 overflow-hidden rounded-full bg-[#F3E4DD]', item.rank <= 3 && 'top-rank-track')}>
                  <motion.div
                    className={cn('h-full origin-right rounded-full', item.rank <= 3 && 'top-rank-fill')}
                    style={{ background: `linear-gradient(90deg, ${type === 'group' ? ORANGE : GOLD}, ${type === 'group' ? GOLD : TEAL})` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: pct / 100 }}
                    transition={{ delay: 0.15 + idx * 0.08, duration: 0.85, ease: 'easeOut' }}
                  />
                </div>
              </div>
              <div className="text-left">
                <p className={cn('text-4xl font-black tabular-nums', item.rank === 1 ? 'text-warning-text' : 'text-foreground')}>{item.total_points.toLocaleString('he-IL')}</p>
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
  const colCount = ordered.length

  return (
    <div className="flex h-full flex-col items-center justify-center px-5">
      <p className="text-2xl font-black text-primary-text">🎯 אלופי ההתמדה</p>
      <h2 className="mt-2 max-w-5xl text-center text-[clamp(3.5rem,6vw,6rem)] font-black leading-none text-foreground">
        {type === 'group' ? 'הקבוצות שהשלימו הכי הרבה משימות' : 'המשתתפים שהשלימו הכי הרבה משימות'}
      </h2>
      <p className="mt-4 text-2xl font-bold text-muted">כי לא רק נקודות - גם ההשקעה נספרת</p>
      <div
        className={cn(
          'mx-auto mt-10 grid w-full gap-5',
          colCount === 1 ? 'max-w-md grid-cols-1' : colCount === 2 ? 'max-w-4xl grid-cols-2' : 'max-w-6xl grid-cols-3',
        )}
      >
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
                <div className="mt-5 inline-flex rounded-full bg-[#FFF1D2] px-4 py-2 text-lg font-black text-primary-text">
                  {rank === 1 ? '🎯 אלוף' : MEDALS[rank - 1] || `#${rank}`}
                </div>
                <h3 className="mt-5 truncate text-4xl font-black text-foreground">{winner.name}</h3>
                <p className="mt-5 text-[6rem] font-black leading-none tabular-nums text-secondary-text">{winner.count.toLocaleString('he-IL')}</p>
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
        <Trophy size={52} className="mx-auto mb-4 text-warning-text" />
        <p className="text-4xl font-black text-foreground">{title}</p>
      </div>
    </div>
  )
}

type SummaryFocus = 'groups' | 'participants' | 'scans' | 'totalParticipants' | 'completedTasks' | 'totalPoints' | 'rewards' | null

function SummaryLeaderboardPreview({
  items,
  pgMap,
  totalGroups,
  groupTaskCounts,
  taskCountByP,
  topPByGroup,
  expanded = false,
  large = false,
  onSelect,
}: {
  items: (RankedGroup | RankedParticipant)[]
  pgMap: Map<string, ParticipantGroupRef[]>
  totalGroups?: number
  groupTaskCounts: Map<string, number>
  taskCountByP: Map<string, number>
  topPByGroup: Map<string, { name: string }>
  expanded?: boolean
  large?: boolean
  onSelect?: (item: RankedGroup | RankedParticipant) => void
}) {
  const visible = expanded ? items : items.slice(0, 3)
  const topPoints = Math.max(1, visible[0]?.total_points || 1)
  void topPByGroup

  if (visible.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[24px] border border-[#E7D6CF]/80 bg-white/70 px-6 text-center shadow-[0_12px_34px_rgba(46,34,30,.08)]">
        <Trophy size={36} className="mb-3 text-[#F2B33C]" />
        <p className="text-2xl font-black text-[#2E221E]">אין עדיין נתונים להצגה</p>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-3', expanded ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[22px] pe-1 summary-scroll' : '', large && 'gap-4')}>
      {visible.map((item, idx) => {
        const isGroup = 'group_name' in item
        const name = isGroup ? item.group_name : item.participant_name
        const id = isGroup ? item.group_id : item.participant_id
        const groups = isGroup ? [] : pgMap.get(item.participant_id) ?? []
        const color = isGroup ? item.group_color : groups[0]?.color || TEAL
        const missions = isGroup ? groupTaskCounts.get(item.group_id) || 0 : taskCountByP.get(item.participant_id) || 0
        const pct = Math.max(5, Math.round((item.total_points / topPoints) * 100))
        const clickable = Boolean(onSelect)

        const rowClass = cn(
          'grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center rounded-[18px] border bg-white/82 text-right shadow-[0_8px_24px_rgba(46,34,30,.08)] backdrop-blur',
          item.rank <= 3 && 'top-rank-row summary-top-rank-row',
          item.rank === 1 && 'top-rank-1',
          item.rank === 2 && 'top-rank-2',
          item.rank === 3 && 'top-rank-3',
          expanded ? 'gap-4 px-5 py-3.5' : large ? 'gap-4 px-5 py-3.5' : 'gap-3 px-4 py-2.5',
          clickable && 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(46,34,30,.16)]',
        )
        const rowStyle = {
          borderColor: item.rank === 1 ? 'rgba(242,179,60,.72)' : item.rank === 2 ? 'rgba(185,174,167,.72)' : item.rank === 3 ? 'rgba(255,147,102,.7)' : 'rgba(231,214,207,.85)',
          borderInlineStartWidth: item.rank <= 3 ? 8 : 1,
          background: item.rank === 1 ? 'linear-gradient(90deg,rgba(242,179,60,.18),rgba(255,255,255,.86))' : 'rgba(255,255,255,.82)',
        } as const

        const content = (
          <>
            <RankBadge rank={item.rank} />
            {isGroup ? (
              <div className={cn('flex items-center justify-center rounded-2xl text-white shadow-lg', large ? 'h-16 w-16' : 'h-14 w-14')} style={{ background: color }}>
                <Users size={large ? 34 : 30} />
              </div>
            ) : (
              <AvatarCircle name={name} size="lg" ringColor={color} className={cn(large ? 'h-16 w-16 text-2xl' : 'h-14 w-14 text-xl')} />
            )}
            <div className="min-w-0">
              <div className="mb-2 flex items-baseline gap-3">
                <h3 className={cn('truncate font-black text-[#2E221E]', expanded || large ? 'text-3xl' : 'text-2xl')}>{name}</h3>
                <span className={cn('shrink-0 font-extrabold text-[#9A8E88]', large ? 'text-lg' : 'text-base')}>{isGroup ? `${missions} משימות` : getParticipantGroupSummary(groups, totalGroups)}</span>
              </div>
              <div className={cn(large ? 'h-4' : 'h-3', 'overflow-hidden rounded-full bg-[#F3E4DD]', item.rank <= 3 && 'top-rank-track')}>
                <motion.div
                  className={cn('h-full origin-right rounded-full bg-[linear-gradient(90deg,#F2B33C,#4FA6A0)]', item.rank <= 3 && 'top-rank-fill')}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: pct / 100 }}
                  transition={{ delay: 0.1 + idx * 0.05, duration: 0.65, ease: 'easeOut' }}
                />
              </div>
              {clickable && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#EF8A4E]">
                  <ClipboardCheck size={16} />
                  צפו ב{missions} המשימות ›
                </div>
              )}
            </div>
            <div className={cn('text-left', expanded || large ? 'min-w-[118px]' : 'min-w-[92px]')}>
              <p className={cn('font-black leading-none tabular-nums', item.rank === 1 ? 'text-[#F2B33C]' : 'text-[#2E221E]', expanded || large ? 'text-4xl' : 'text-3xl')}>
                {item.total_points.toLocaleString('he-IL')}
              </p>
              <p className="text-sm font-extrabold text-[#9A8E88]">נקודות</p>
            </div>
          </>
        )

        if (clickable) {
          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => onSelect?.(item)}
              className={rowClass}
              style={rowStyle}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.35 }}
            >
              {content}
            </motion.button>
          )
        }

        return (
          <motion.div
            key={id}
            className={rowClass}
            style={rowStyle}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.35 }}
          >
            {content}
          </motion.div>
        )
      })}
    </div>
  )
}

function SummaryMetricCard({
  id,
  title,
  value,
  label,
  icon,
  accent,
  emptyText,
  focused,
  onClick,
}: {
  id: Exclude<SummaryFocus, null>
  title: string
  value: number
  label: string
  icon: ReactNode
  accent: string
  emptyText: string
  focused: boolean
  onClick: (id: Exclude<SummaryFocus, null>) => void
}) {
  const isEmpty = value === 0

  return (
    <motion.button
      type="button"
      layoutId={`summary-${id}`}
      onClick={() => onClick(id)}
      className={cn(
        'group relative min-h-[130px] overflow-hidden rounded-[22px] border bg-white/82 p-4 text-right shadow-[0_18px_54px_rgba(46,34,30,.12)] backdrop-blur transition',
        focused ? 'cursor-zoom-out' : 'cursor-zoom-in hover:-translate-y-1',
      )}
      style={{ borderColor: `${accent}80` }}
      whileHover={{ scale: focused ? 1 : 1.016 }}
      whileTap={{ scale: 0.985 }}
    >
      <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 0%, ${accent}, transparent 58%)` }} />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-[4px] border-white text-white shadow-[0_12px_30px_rgba(120,50,10,.18)]" style={{ background: `linear-gradient(135deg, ${accent}, #FFB800)` }}>
            {icon}
          </div>
          <span className="rounded-full bg-[#FFF1D2] px-3 py-1.5 text-sm font-black text-[#EF8A4E]">{title}</span>
        </div>
        {isEmpty ? (
          <div className="mt-6">
            <p className="text-xl font-black text-[#2E221E]">אין עדיין נתונים</p>
            <p className="mt-1 text-sm font-extrabold text-[#7D706A]">{emptyText}</p>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-[2.9rem] font-black leading-none tabular-nums text-[#2E221E]">{value.toLocaleString('he-IL')}</p>
            <p className="text-sm font-black text-[#7D706A]">{label}</p>
          </div>
        )}
      </div>
    </motion.button>
  )
}

function FocusedSummaryHeader({ icon, title, subtitle, accent }: { icon: ReactNode; title: string; subtitle: string; accent: string }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-6">
      <div>
        <p className="text-xl font-black text-[#EF8A4E]">{subtitle}</p>
        <h3 className="mt-1 text-[3.4rem] font-black leading-none text-[#2E221E]">{title}</h3>
      </div>
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-[6px] border-white text-white shadow-[0_16px_46px_rgba(46,34,30,.2)]" style={{ background: `linear-gradient(135deg, ${accent}, #FFB800)` }}>
        {icon}
      </div>
    </div>
  )
}

interface SelectedEntry {
  type: 'group' | 'participant'
  id: string
  name: string
  color: string
}

function EntryTasksOverlay({ entry, transactions, onClose }: { entry: SelectedEntry; transactions: TxRow[]; onClose: () => void }) {
  const isGroup = entry.type === 'group'
  const summary = useMemo(() => {
    const m = new Map<string, { name: string; count: number; points: number; last: string }>()
    for (const tx of transactions) {
      const existing = m.get(tx.action_id)
      if (existing) {
        existing.count += 1
        existing.points += tx.points
        if (tx.created_at > existing.last) existing.last = tx.created_at
      } else {
        m.set(tx.action_id, { name: tx.action?.name ?? 'משימה', count: 1, points: tx.points, last: tx.created_at })
      }
    }
    return [...m.values()].sort((a, b) => b.count - a.count || b.points - a.points)
  }, [transactions])
  const totalTasks = transactions.length
  const totalPoints = transactions.reduce((sum, tx) => sum + (tx.points || 0), 0)

  return (
    <motion.div
      className="absolute inset-0 z-[60] flex items-center justify-center rounded-[28px] bg-[#2E221E]/45 p-8 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative flex h-full max-h-[760px] w-full max-w-[1040px] flex-col overflow-hidden rounded-[34px] border border-[#F2B33C]/60 bg-[linear-gradient(150deg,#FFFDF7,#FFF4E6)] p-8 shadow-[0_34px_100px_rgba(46,34,30,.28)]"
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 18 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-y-0 -right-1/3 w-1/3 rotate-12 bg-gradient-to-l from-transparent via-white/70 to-transparent animate-light-sweep" />
        <button
          type="button"
          onClick={onClose}
          className="absolute left-6 top-6 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-[#E7D6CF]/80 bg-white/88 text-[#7D706A] shadow-[0_10px_28px_rgba(46,34,30,.12)] transition hover:scale-105 hover:text-[#2E221E]"
          aria-label="סגירה"
        >
          <X size={22} />
        </button>

        <div className="relative mb-6 flex items-center gap-5">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[6px] border-white text-white shadow-[0_16px_46px_rgba(46,34,30,.2)]"
            style={{ background: `linear-gradient(135deg, ${entry.color || TEAL}, #FFB800)` }}
          >
            {isGroup ? <Users size={34} /> : <AvatarCircle name={entry.name} size="lg" ringColor={entry.color} className="h-20 w-20 text-3xl ring-0" />}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-black text-[#EF8A4E]">{isGroup ? 'כל המשימות שהקבוצה ביצעה' : 'כל המשימות שהמשתתף ביצע'}</p>
            <h3 className="truncate text-[3rem] font-black leading-none text-[#2E221E]">{entry.name}</h3>
            <p className="mt-2 text-lg font-extrabold text-[#7D706A]">
              {totalTasks.toLocaleString('he-IL')} משימות · {totalPoints.toLocaleString('he-IL')} נקודות
            </p>
          </div>
        </div>

        {summary.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-[24px] border border-[#E7D6CF]/80 bg-white/70 text-center shadow-[0_12px_34px_rgba(46,34,30,.08)]">
            <ClipboardCheck size={40} className="mb-3 text-[#F2B33C]" />
            <p className="text-2xl font-black text-[#2E221E]">טרם בוצעו משימות</p>
          </div>
        ) : (
          <div className="relative grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain pe-1 summary-scroll">
            {summary.map((task, idx) => (
              <motion.div
                key={task.name + idx}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-[18px] border border-[#E7D6CF]/85 bg-white/82 px-5 py-3.5 shadow-[0_8px_24px_rgba(46,34,30,.08)] backdrop-blur"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.4), duration: 0.3 }}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1D2] text-[#EF8A4E] shadow-sm">
                  <ClipboardCheck size={24} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-2xl font-black text-[#2E221E]">{task.name}</p>
                  <p className="text-sm font-extrabold text-[#9A8E88]">
                    {task.count > 1 ? `בוצעה ${task.count.toLocaleString('he-IL')} פעמים · ` : ''}
                    {formatDistanceToNow(new Date(task.last), { addSuffix: true, locale: he })}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-3xl font-black leading-none tabular-nums text-[#2E221E]">
                    {task.points >= 0 ? '+' : ''}
                    {task.points.toLocaleString('he-IL')}
                  </p>
                  <p className="text-sm font-extrabold text-[#9A8E88]">נקודות</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

function FinalSummaryPhase({
  rankedG,
  rankedP,
  pgMap,
  totalGroups,
  groupTaskCounts,
  taskCountByP,
  txByParticipant,
  txByGroup,
  topPByGroup,
  totalScans,
  totalParticipants,
  totalPointsEarned,
  totalRewardsAwarded,
  onInteractingChange,
}: {
  rankedG: RankedGroup[]
  rankedP: RankedParticipant[]
  pgMap: Map<string, ParticipantGroupRef[]>
  totalGroups: number
  groupTaskCounts: Map<string, number>
  taskCountByP: Map<string, number>
  txByParticipant: Map<string, TxRow[]>
  txByGroup: Map<string, TxRow[]>
  topPByGroup: Map<string, { name: string }>
  totalScans: number
  totalParticipants: number
  totalPointsEarned: number
  totalRewardsAwarded: number
  onInteractingChange?: (interacting: boolean) => void
}) {
  const [focus, setFocus] = useState<SummaryFocus>(null)
  const [selected, setSelected] = useState<SelectedEntry | null>(null)

  // Pause the auto-advancing ceremony while the viewer is drilling into the data.
  useEffect(() => {
    onInteractingChange?.(focus !== null)
    return () => onInteractingChange?.(false)
  }, [focus, onInteractingChange])
  const toggleFocus = (id: Exclude<SummaryFocus, null>) => {
    setSelected(null)
    setFocus((current) => (current === id ? null : id))
  }

  const handleSelectGroup = (item: RankedGroup | RankedParticipant) => {
    const group = item as RankedGroup
    setSelected({ type: 'group', id: group.group_id, name: group.group_name, color: group.group_color || GOLD })
  }
  const handleSelectParticipant = (item: RankedGroup | RankedParticipant) => {
    const participant = item as RankedParticipant
    const color = (pgMap.get(participant.participant_id) ?? [])[0]?.color || TEAL
    setSelected({ type: 'participant', id: participant.participant_id, name: participant.participant_name, color })
  }
  const selectedTransactions = selected
    ? (selected.type === 'group' ? txByGroup.get(selected.id) : txByParticipant.get(selected.id)) ?? []
    : []

  const renderFocused = () => {
    if (focus === 'groups') {
      return (
        <>
          <FocusedSummaryHeader icon={<Users size={34} />} title="הדירוג המלא של הקבוצות" subtitle="לחצו על קבוצה כדי לראות את כל המשימות שלה" accent={GOLD} />
          <SummaryLeaderboardPreview expanded large items={rankedG} pgMap={pgMap} totalGroups={totalGroups} groupTaskCounts={groupTaskCounts} taskCountByP={taskCountByP} topPByGroup={topPByGroup} onSelect={handleSelectGroup} />
        </>
      )
    }
    if (focus === 'participants') {
      return (
        <>
          <FocusedSummaryHeader icon={<Trophy size={34} />} title="הדירוג המלא של המשתתפים" subtitle="לחצו על משתתף כדי לראות את כל המשימות שלו" accent={TEAL} />
          <SummaryLeaderboardPreview expanded large items={rankedP} pgMap={pgMap} totalGroups={totalGroups} groupTaskCounts={groupTaskCounts} taskCountByP={taskCountByP} topPByGroup={topPByGroup} onSelect={handleSelectParticipant} />
        </>
      )
    }

    const metric = focus === 'scans'
      ? { title: 'כל הסריקות', value: totalScans, label: 'סריקות בוצעו', icon: <ScanLine size={24} />, accent: ORANGE, emptyText: 'אין עדיין סריקות להצגה' }
      : focus === 'totalParticipants'
        ? { title: 'כל המשתתפים', value: totalParticipants, label: 'משתתפים באירוע', icon: <Users size={24} />, accent: TEAL, emptyText: 'אין עדיין משתתפים להצגה' }
        : focus === 'completedTasks'
          ? { title: 'כל המשימות שהושלמו', value: totalScans, label: 'משימות הושלמו', icon: <Award size={24} />, accent: GREEN, emptyText: 'אין עדיין משימות שהושלמו' }
          : focus === 'totalPoints'
            ? { title: 'כל הנקודות', value: totalPointsEarned, label: 'נקודות נצברו', icon: <Trophy size={24} />, accent: WARM_ORANGE, emptyText: 'אין עדיין נקודות להצגה' }
            : { title: 'כל הפרסים', value: totalRewardsAwarded, label: 'פרסים הוענקו', icon: <Gift size={24} />, accent: GOLD, emptyText: 'אין עדיין פרסים להציג' }

    return (
      <>
        <FocusedSummaryHeader icon={metric.icon} title={metric.title} subtitle="סיכום הנופש" accent={metric.accent} />
        <div className="flex flex-1 items-center justify-center">
          <div className="relative overflow-hidden rounded-[34px] border bg-white/84 px-14 py-10 text-center shadow-[0_28px_72px_rgba(46,34,30,.16)] backdrop-blur" style={{ borderColor: `${metric.accent}99` }}>
            <div className="absolute inset-0 opacity-25" style={{ background: `radial-gradient(circle at 50% 0%, ${metric.accent}, transparent 62%)` }} />
            <div className="relative">
              {metric.value === 0 ? (
                <>
                  <p className="text-5xl font-black text-[#2E221E]">אין עדיין נתונים</p>
                  <p className="mt-4 text-2xl font-extrabold text-[#7D706A]">{metric.emptyText}</p>
                </>
              ) : (
                <>
                  <p className="text-[8rem] font-black leading-none tabular-nums text-[#2E221E]">{metric.value.toLocaleString('he-IL')}</p>
                  <p className="mt-2 text-3xl font-black text-[#7D706A]">{metric.label}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="relative flex h-full flex-col px-7 py-1">
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-3 rounded-full bg-[#FFF1D2] px-6 py-2 text-xl font-black text-[#EF8A4E] shadow-[0_8px_22px_rgba(255,147,102,.25)]">
          <Sparkles size={22} fill="currentColor" />
          סיכום הנופש
        </div>
        <h2 className="mt-3 text-[56px] font-black leading-none text-[#2E221E]">הנופש במספרים</h2>
        <p className="mt-2 text-xl font-extrabold text-[#7D706A]">סיכום סטטיסטי מלא של הנופש, עם כל הדירוגים והמספרים החשובים במקום אחד</p>
      </div>

      <div className="grid flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4">
        <div className="grid grid-cols-5 gap-5">
          <SummaryMetricCard id="scans" title="סריקות" value={totalScans} label="סריקות בוצעו" icon={<ScanLine size={22} />} accent={ORANGE} emptyText="אין עדיין סריקות להצגה" focused={focus === 'scans'} onClick={toggleFocus} />
          <SummaryMetricCard id="totalParticipants" title="משתתפים" value={totalParticipants} label="משתתפים באירוע" icon={<Users size={22} />} accent={TEAL} emptyText="אין עדיין משתתפים להצגה" focused={focus === 'totalParticipants'} onClick={toggleFocus} />
          <SummaryMetricCard id="completedTasks" title="משימות" value={totalScans} label="משימות הושלמו" icon={<Award size={22} />} accent={GREEN} emptyText="אין עדיין משימות שהושלמו" focused={focus === 'completedTasks'} onClick={toggleFocus} />
          <SummaryMetricCard id="totalPoints" title="נקודות" value={totalPointsEarned} label="נקודות נצברו" icon={<Trophy size={22} />} accent={WARM_ORANGE} emptyText="אין עדיין נקודות להצגה" focused={focus === 'totalPoints'} onClick={toggleFocus} />
          <SummaryMetricCard id="rewards" title="פרסים" value={totalRewardsAwarded} label="פרסים הוענקו" icon={<Gift size={22} />} accent={GOLD} emptyText="אין עדיין פרסים להציג" focused={focus === 'rewards'} onClick={toggleFocus} />
        </div>
        <div className="grid min-h-0 grid-cols-2 gap-5">
          <motion.button
            type="button"
            layoutId="summary-groups"
            onClick={() => toggleFocus('groups')}
            className="relative min-h-0 overflow-hidden rounded-[26px] border border-[#F2B33C]/60 bg-white/78 p-6 text-right shadow-[0_18px_54px_rgba(46,34,30,.12)] backdrop-blur transition hover:-translate-y-1"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-[#FFF1D2] px-5 py-2 text-lg font-black text-[#EF8A4E]">דירוג הקבוצות</span>
              <Users size={34} className="text-[#F2B33C]" />
            </div>
            <SummaryLeaderboardPreview large items={rankedG} pgMap={pgMap} totalGroups={totalGroups} groupTaskCounts={groupTaskCounts} taskCountByP={taskCountByP} topPByGroup={topPByGroup} />
          </motion.button>
          <motion.button
            type="button"
            layoutId="summary-participants"
            onClick={() => toggleFocus('participants')}
            className="relative min-h-0 overflow-hidden rounded-[26px] border border-[#4FA6A0]/60 bg-white/78 p-6 text-right shadow-[0_18px_54px_rgba(46,34,30,.12)] backdrop-blur transition hover:-translate-y-1"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-[#E4F4F0] px-5 py-2 text-lg font-black text-[#3E8F88]">דירוג המשתתפים</span>
              <Award size={34} className="text-[#4FA6A0]" />
            </div>
            <SummaryLeaderboardPreview large items={rankedP} pgMap={pgMap} totalGroups={totalGroups} groupTaskCounts={groupTaskCounts} taskCountByP={taskCountByP} topPByGroup={topPByGroup} />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {focus && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center rounded-[28px] bg-[#FFF8F3]/72 p-10 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setSelected(null)
              setFocus(null)
            }}
          >
            <motion.div
              layoutId={`summary-${focus}`}
              className="relative flex h-full max-h-[780px] w-full max-w-[1320px] flex-col overflow-hidden rounded-[38px] border border-[#F2B33C]/60 bg-[linear-gradient(150deg,#FFFDF7,#FFF4E6)] p-8 shadow-[0_34px_100px_rgba(46,34,30,.22)]"
              initial={{ scale: 0.92, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 18 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute inset-y-0 -right-1/3 w-1/3 rotate-12 bg-gradient-to-l from-transparent via-white/70 to-transparent animate-light-sweep" />
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  setFocus(null)
                }}
                className="absolute left-6 top-6 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-[#E7D6CF]/80 bg-white/88 text-[#7D706A] shadow-[0_10px_28px_rgba(46,34,30,.12)] transition hover:scale-105 hover:text-[#2E221E]"
                aria-label="הקטן"
              >
                <Minimize2 size={22} />
              </button>
              <div className="relative flex h-full flex-col">{renderFocused()}</div>
              <AnimatePresence>
                {selected && <EntryTasksOverlay entry={selected} transactions={selectedTransactions} onClose={() => setSelected(null)} />}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ArenaNotReadyScreen({
  eventName,
  eventLogoUrl,
}: {
  eventName?: string
  eventLogoUrl?: string | null
}) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-app-radial font-sans text-foreground" dir="rtl">
      <AmbientBackdrop />
      <StageHeader eventName={eventName} eventLogoUrl={eventLogoUrl} />

      <main className="absolute inset-x-6 bottom-[72px] top-[212px] z-10 flex items-center justify-center px-2 md:inset-x-10">
        <motion.section
          className="relative flex w-full max-w-[920px] max-h-[720px] flex-col items-center overflow-hidden rounded-[38px] border-2 border-[#F2B33C]/55 bg-[linear-gradient(150deg,#FFFDF7,#FFF4E6)] px-7 py-10 text-center shadow-[0_24px_72px_rgba(46,34,30,0.16)] md:px-12 md:py-12"
          initial={{ opacity: 0, scale: 0.98, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-x-0 top-0 h-2 bg-[linear-gradient(90deg,#FF9366,#FFB84D,#FFD68A,#8FCFA0,#5FB3AA)]" />
          <div className="absolute -right-1/4 top-0 h-full w-1/3 rotate-12 bg-gradient-to-l from-transparent via-white/70 to-transparent animate-light-sweep" />
          <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(242,179,60,.32), transparent 55%)' }} />

          <div className="relative mx-auto flex max-w-3xl flex-col items-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#F2B33C]/30 bg-white/72 px-4 py-2 text-sm font-black text-[#EF8A4E] shadow-[0_8px_22px_rgba(255,147,102,.16)]">
              <Trophy size={16} />
              🏆 הטקס עוד רגע מתחיל
            </div>

            <motion.div
              className="relative mb-8 flex h-32 w-32 items-center justify-center rounded-full border-[7px] border-white bg-[linear-gradient(135deg,#FFF1D2,#FFB84D)] text-white shadow-[0_16px_42px_rgba(46,34,30,.2)] md:h-40 md:w-40"
              animate={{ y: [0, -8, 0], rotate: [0, -4, 4, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="absolute inset-[-22px] rounded-full bg-[#F2B33C]/14 blur-2xl" />
              <Users size={72} className="relative drop-shadow-[0_0_16px_rgba(255,255,255,.35)] md:size-[88px]" />
            </motion.div>

            <h2 className="max-w-3xl text-[clamp(3rem,4.8vw,5rem)] font-black leading-[0.92] text-[#2E221E]">
              הטקס עוד רגע מתחיל
            </h2>
            <p className="mt-5 max-w-2xl text-[clamp(1.1rem,1.45vw,1.55rem)] font-extrabold leading-tight text-[#7D706A]">
              ממתינים לעוד כמה משתתפים שיצטרפו למשחק.
            </p>
          </div>
        </motion.section>
      </main>
    </div>
  )
}

/**
 * Replay / pause, portalled into the top-right toolbar next to the sound
 * toggle. They used to sit on a bar at the bottom of the stage together with a
 * dot per phase; the dots only told you which slide was showing, which nobody
 * watching the ceremony needs, so the bar is gone and the two buttons that do
 * matter joined the rest of the screen controls.
 */
function CeremonyControls({ onReplay, paused, onTogglePause }: { onReplay: () => void; paused: boolean; onTogglePause: () => void }) {
  const controlClass = cn(screenControlClass, 'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold')

  return (
    <ScreenControlsExtra>
      <button type="button" onClick={onTogglePause} className={controlClass} title={paused ? 'המשך' : 'השהה'}>
        {paused ? <Play size={14} strokeWidth={2.25} className="text-neutral-400" /> : <Pause size={14} strokeWidth={2.25} className="text-neutral-400" />}
        <span>{paused ? 'המשך' : 'השהה'}</span>
      </button>
      <button type="button" onClick={onReplay} className={controlClass} title="הצג שוב">
        <RotateCcw size={14} strokeWidth={2.25} className="text-neutral-400" />
        <span>הצג שוב</span>
      </button>
    </ScreenControlsExtra>
  )
}

export function WinnersCeremony({ eventId, eventName, eventLogoUrl }: WinnersCeremonyProps) {
  const { rankedP, rankedG, hasGroups, totalGroupCount, taskCountByP, groupTaskCounts, txByParticipant, txByGroup, topPByGroup, taskStats, pgMap, totalScans, totalParticipants, totalPointsEarned, totalRewardsAwarded, ceremonyReadiness, loading, error } = useLeaderboardData(eventId)
  const { playApplause, muted } = useSound()
  const { play: playFanfare } = useCelebrationSound()
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [replayNonce, setReplayNonce] = useState(0)
  const [paused, setPaused] = useState(false)
  const [summaryInteracting, setSummaryInteracting] = useState(false)
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
    if (paused || summaryInteracting || loading || error || rankedP.length === 0 || !phase || phases.length === 0) return undefined
    const timer = window.setTimeout(() => {
      setPhaseIndex((idx) => {
        const next = idx + 1
        if (next < phases.length) return next
        return autoLoop ? 0 : idx
      })
    }, phase.duration / revealSpeed)
    return () => window.clearTimeout(timer)
  }, [autoLoop, error, loading, paused, summaryInteracting, phase, phases.length, rankedP.length, replayNonce, revealSpeed])

  useEffect(() => {
    if (!phase || !isChampionPhase || applausePhaseRef.current === phase.kind) return undefined
    applausePhaseRef.current = phase.kind
    const timer = window.setTimeout(() => {
      playApplause(1)
      if (!muted) playFanfare()
    }, 200)
    return () => window.clearTimeout(timer)
  }, [isChampionPhase, muted, phase, playApplause, playFanfare])

  function handleReplay() {
    applausePhaseRef.current = null
    setSummaryInteracting(false)
    setPhaseIndex(0)
    setReplayNonce((n) => n + 1)
  }

  const champGroup = rankedG[0]
  const champParticipant = rankedP[0]
  const groupRunnerUp = rankedG.find((g) => g.rank === 2)
  const participantRunnerUp = rankedP.find((p) => p.rank === 2)
  const participantGroups = champParticipant ? pgMap.get(champParticipant.participant_id) ?? [] : []
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
        .map((p) => ({ id: p.participant_id, name: p.participant_name, count: taskCountByP.get(p.participant_id) || 0, color: (pgMap.get(p.participant_id) ?? [])[0]?.color }))
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

  if (!ceremonyReadiness.isReady) {
    return (
      <ArenaNotReadyScreen eventName={eventName} eventLogoUrl={eventLogoUrl} />
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
          <StageHeader eventName={eventName} eventLogoUrl={eventLogoUrl} />
          {/* Fills whatever the header leaves of the 1080px stage. */}
          <main className="relative z-10 px-2 pb-8" style={{ height: 1080 - HEADER_HEIGHT }}>
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
                {phase.kind === 'groupChampion' && <ChampionPhase type="group" champ={champGroup} runnerUp={groupRunnerUp} totalGroups={totalGroupCount} />}
                {phase.kind === 'groupPodium' && <PodiumPhase title="הקבוצות המובילות" type="group" items={rankedG.slice(0, 3)} />}
                {phase.kind === 'groupLeaderboard' && (
                  <LeaderboardPhase title="טבלת הקבוצות" subtitle="דירוג מלא" type="group" items={rankedG} pgMap={pgMap} totalGroups={totalGroupCount} taskCountByP={taskCountByP} groupTaskCounts={groupTaskCounts} topPByGroup={topPByGroup} />
                )}
                {phase.kind === 'participantChampion' && <ChampionPhase type="participant" champ={champParticipant} runnerUp={participantRunnerUp} groups={participantGroups} totalGroups={totalGroupCount} />}
                {phase.kind === 'participantPodium' && <PodiumPhase title="המשתתפים המובילים" type="participant" items={rankedP.slice(0, 3)} />}
                {phase.kind === 'participantLeaderboard' && (
                  <LeaderboardPhase title="טבלת המשתתפים" subtitle="דירוג מלא" type="participant" items={rankedP} pgMap={pgMap} totalGroups={totalGroupCount} taskCountByP={taskCountByP} groupTaskCounts={groupTaskCounts} topPByGroup={topPByGroup} />
                )}
                {phase.kind === 'groupMissions' && <MissionsPhase type="group" winners={groupMissionWinners} />}
                {phase.kind === 'participantMissions' && <MissionsPhase type="participant" winners={participantMissionWinners} />}
                {phase.kind === 'finalSummary' && (
                  <FinalSummaryPhase
                    rankedG={rankedG}
                    rankedP={rankedP}
                    pgMap={pgMap}
                    totalGroups={totalGroupCount}
                    groupTaskCounts={groupTaskCounts}
                    taskCountByP={taskCountByP}
                    txByParticipant={txByParticipant}
                    txByGroup={txByGroup}
                    topPByGroup={topPByGroup}
                    totalScans={totalScans}
                    totalParticipants={totalParticipants}
                    totalPointsEarned={totalPointsEarned}
                    totalRewardsAwarded={totalRewardsAwarded}
                    onInteractingChange={setSummaryInteracting}
                  />
                )}
              </motion.section>
            </AnimatePresence>
          </main>
          <CeremonyControls onReplay={handleReplay} paused={paused} onTogglePause={() => setPaused((p) => !p)} />
          <span className="sr-only">{taskStats.length} סוגי משימות נספרו</span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-[#FFF8F3] to-transparent" />
    </div>
  )
}


