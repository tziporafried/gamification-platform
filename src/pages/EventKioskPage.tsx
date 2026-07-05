import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { computeRanks } from '@/lib/missionUtils'
import { ManualEntryForm } from '@/components/scoring/ManualEntryForm'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import { useScoreSubmit } from '@/hooks/useScoreSubmit'
import { useEventCatalog } from '@/hooks/useEventCatalog'
import { parseQrPayload } from '@/lib/qrPayload'
import { hexToRgb } from '@/lib/accentColor'
import {
  buildActionCompletionIndex,
  filterActionsWithAvailableParticipants,
  type ActionCompletionIndex,
  type KioskAvailabilityParticipant,
} from '@/lib/canPerformAction'
import {
  formatRemainingAsTimer,
  getDailyTimeWindow,
  getDailyWindowRemainingMinutes,
  hasDailyTimeWindow,
  isInDailyTimeWindow,
} from '@/lib/taskLimit'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import type { Event, GroupLeaderboardEntry, ParticipantLeaderboardEntry } from '@/types'
import type { ScoreSubmitResult } from '@/hooks/useScoreSubmit'
import '@/styles/kiosk.css'

const KIOSK_ACCENT = hexToRgb('#AB3500') ?? { r: 171, g: 53, b: 0 }
const ACTIVITY_ACCENTS = ['#FF8A4D', '#4FA6A0', '#F2B33C']
const ACTIVITY_ICONS = ['🎯', '⭐', '🏆', '✨', '🔥', '💪', '🌟', '🎊', '👏', '🚀', '💫', '🎖️', '✅', '🙌', '⚡']

function stableHash(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return hash
}

function activityIconForId(id: string): string {
  return ACTIVITY_ICONS[stableHash(id) % ACTIVITY_ICONS.length]
}

function activityAccentForId(id: string): string {
  return ACTIVITY_ACCENTS[stableHash(id) % ACTIVITY_ACCENTS.length]
}

function activityRowMotionForId(id: string) {
  const h = stableHash(id)
  return {
    iconDuration: `${(3.4 + (h % 5) * 0.32).toFixed(2)}s`,
    iconDelay: `${(((h >> 3) % 10) * 0.19).toFixed(2)}s`,
    pointsDuration: `${(3.2 + ((h >> 6) % 5) * 0.4).toFixed(2)}s`,
    pointsDelay: `${(((h >> 9) % 12) * 0.23).toFixed(2)}s`,
  }
}

function formatActivityRelativeTime(createdAt: string, reference = new Date()): string {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return ''
  const diffMs = reference.getTime() - created.getTime()
  if (diffMs < 60_000) return 'ממש עכשיו'
  return formatDistanceToNow(created, { addSuffix: true, locale: he })
}

// Generates the decorative QR matrix shown in the scanner frame.
// Deterministic LCG seeded to 41 — same result every render.
function makeQrMatrix(n: number, seed: number): number[][] {
  let s = seed >>> 0
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  const m: number[][] = []
  for (let r = 0; r < n; r++) {
    const row: number[] = []
    for (let c = 0; c < n; c++) row.push(rnd() > 0.52 ? 1 : 0)
    m.push(row)
  }
  const finder = (R: number, C: number) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const r = R + i, c = C + j
      if (r < 0 || c < 0 || r >= n || c >= n) continue
      const inRange = i >= 0 && i <= 6 && j >= 0 && j <= 6
      if (!inRange) { m[r][c] = 0; continue }
      const edge = i === 0 || i === 6 || j === 0 || j === 6
      const inner = i >= 2 && i <= 4 && j >= 2 && j <= 4
      m[r][c] = edge || inner ? 1 : 0
    }
  }
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0)
  return m
}
const QR_MATRIX = makeQrMatrix(21, 41)

// ─── Types ────────────────────────────────────────────────────────────────────
type RankRow = { id: string; name: string; initial: string; score: number; barPct: number; medal?: 1 | 2 | 3 }
type ActivityRow = {
  id: string
  icon: string
  title: string
  subtitle: string
  points: string
  accent: string
  createdAt: string
}
type RewardRow = { id: string; icon: string; title: string; recipient: string; score: number; accent: string }
type TopPrizeRow = { id: string; name: string; icon: string; requiredPoints: number; accent: string }
type KioskGroup = { id: string; name: string; color: string }
type KioskAction = {
  id: string
  name: string
  points: number
  max_completions: number | null
  daily_limit: boolean
  daily_start_hour: number | null
  daily_start_minute: number | null
  daily_end_hour: number | null
  daily_end_minute: number | null
  groups: KioskGroup[]
}
type ScanResultDisplay = { name: string; action: string; initial: string; emoji: string; points: number; totalPoints: number; tone: string }
type RewardWinDisplay = { emoji: string; title: string; sub: string; points: number }

interface KioskStats {
  totalMissions: number
  totalPoints: number
  totalGroups: number
}

interface KioskData {
  rankedGroups: RankRow[]
  topPlayers: RankRow[]
  recentActivity: ActivityRow[]
  rewards: RewardRow[]
  topPrizes: TopPrizeRow[]
  configuredRewardsCount: number
  newestRewardId: string | null
  actions: KioskAction[]
  kioskParticipants: KioskAvailabilityParticipant[]
  actionCompletionIndex: ActionCompletionIndex
  stats: KioskStats
  totalScans: number
  loading: boolean
  error: boolean
  refetch: () => void
}

function isGameStarted(event: Event): boolean {
  return event.status === 'active'
}

function rewardTier(pts: number): { icon: string; accent: string } {
  if (pts >= 1000) return { icon: '🏅', accent: '#F2B33C' }
  if (pts >= 500) return { icon: '🎖️', accent: '#4FA6A0' }
  return { icon: '🏆', accent: '#FF8A4D' }
}

// ─── Hooks & utilities ────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

function playSuccessChime() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx() as AudioContext
    const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.11
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.2, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
      osc.start(t)
      osc.stop(t + 0.55)
    })
  } catch { /* ignore WebAudio errors */ }
}

// Seeded PRNG for stable module-level particle arrays
function _seededRnd(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff }
}

const CONFETTI_COLORS = ['#FF9366', '#F2B33C', '#5FB3AA', '#8FCFA0', '#FFB84D', '#FF7350', '#FFD68A', '#4C9E6E']

const CONFETTI_PARTICLES = (() => {
  const rnd = _seededRnd(77)
  return Array.from({ length: 46 }, (_, i) => ({
    id: i,
    left: rnd() * 100,
    size: 8 + rnd() * 10,
    duration: 2.2 + rnd() * 2.4,
    delay: rnd() * 1.8,
    color: CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)],
    isCircle: rnd() > 0.5,
    rotation: Math.floor(rnd() * 360),
  }))
})()

const COIN_PARTICLES = (() => {
  const rnd = _seededRnd(99)
  return Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * 2 * Math.PI + rnd() * 0.4
    const dist = 150 + rnd() * 150
    return { id: i, tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist, delay: rnd() * 0.5, duration: 0.8 + rnd() * 0.5 }
  })
})()

// ─── Data hook ────────────────────────────────────────────────────────────────
function useKioskData(eventId: string, gameStarted: boolean): KioskData {
  const [groupData, setGroupData] = useState<GroupLeaderboardEntry[]>([])
  const [participantData, setParticipantData] = useState<ParticipantLeaderboardEntry[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [txData, setTxData] = useState<any[]>([])
  const [txCount, setTxCount] = useState(0)
  const [txPointsTotal, setTxPointsTotal] = useState(0)
  const [actionsData, setActionsData] = useState<KioskAction[]>([])
  const [kioskParticipants, setKioskParticipants] = useState<KioskAvailabilityParticipant[]>([])
  const [actionCompletionIndex, setActionCompletionIndex] = useState<ActionCompletionIndex>({})
  const [rewardsData, setRewardsData] = useState<RewardRow[]>([])
  const [topPrizesData, setTopPrizesData] = useState<TopPrizeRow[]>([])
  const [configuredRewardsCount, setConfiguredRewardsCount] = useState(0)
  const [newestRewardId, setNewestRewardId] = useState<string | null>(null)
  const newestClearTimer = useRef<ReturnType<typeof setTimeout>>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!eventId) return
    try {
      const [gRes, pRes, txRes, countRes, pointsRes, actRes, partRes, completionRes, rwRes, tpRes, configuredRwRes] = await Promise.all([
        supabase.rpc('get_group_leaderboard', { p_event_id: eventId }),
        supabase.rpc('get_participant_leaderboard', { p_event_id: eventId }),
        supabase
          .from('point_transactions')
          .select('id, points, created_at, participant:participants(name), action:actions(id, name, code)')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('point_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId),
        supabase
          .from('point_transactions')
          .select('points')
          .eq('event_id', eventId),
        supabase
          .from('actions')
          .select('id, name, points, max_completions, daily_limit, daily_start_hour, daily_start_minute, daily_end_hour, daily_end_minute, action_groups(group_id, groups(id, name, color))')
          .eq('event_id', eventId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('participants')
          .select('id, participant_groups(group_id)')
          .eq('event_id', eventId),
        supabase
          .from('point_transactions')
          .select('participant_id, action_id, created_at')
          .eq('event_id', eventId),
        supabase
          .from('participant_rewards')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select('id, awarded_at, reward:rewards(name, required_points), participant:participants(name)' as any)
          .eq('event_id', eventId)
          .order('awarded_at', { ascending: false })
          .limit(5),
        supabase
          .from('rewards')
          .select('id, name, required_points')
          .eq('event_id', eventId)
          .eq('is_active', true)
          .order('required_points', { ascending: false })
          .limit(3),
        supabase
          .from('rewards')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId),
      ])

      if (gRes.error && pRes.error) { setError(true); return }
      setError(false)

      if (gRes.data) setGroupData(gRes.data as GroupLeaderboardEntry[])
      if (pRes.data) setParticipantData(pRes.data as ParticipantLeaderboardEntry[])
      if (txRes.data) setTxData(txRes.data as unknown as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      setTxCount(countRes.count ?? 0)
      setTxPointsTotal((pointsRes.data ?? []).reduce((sum, tx) => sum + (tx.points ?? 0), 0))

      if (actRes.data) {
        setActionsData(actRes.data.map((a) => {
          const joins = (a.action_groups as unknown as { groups: { id: string; name: string; color: string } | { id: string; name: string; color: string }[] }[]) ?? []
          const groups = joins
            .map((join) => {
              const group = join.groups
              return Array.isArray(group) ? group[0] : group
            })
            .filter((group): group is KioskGroup => Boolean(group?.id && group?.name && group?.color))
          return {
            id: a.id,
            name: a.name,
            points: a.points,
            max_completions: a.max_completions,
            daily_limit: a.daily_limit,
            daily_start_hour: a.daily_start_hour,
            daily_start_minute: a.daily_start_minute,
            daily_end_hour: a.daily_end_hour,
            daily_end_minute: a.daily_end_minute,
            groups,
          }
        }))
      }

      if (partRes.data) {
        setKioskParticipants(partRes.data.map((p) => {
          const joins = (p.participant_groups as unknown as { group_id: string }[]) ?? []
          return {
            id: p.id,
            groupIds: joins.map((join) => join.group_id).filter(Boolean),
          }
        }))
      }

      if (completionRes.data) {
        setActionCompletionIndex(buildActionCompletionIndex(completionRes.data))
      }

      if (rwRes.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRewardsData((rwRes.data as any[]).map(r => {
          const reward = Array.isArray(r.reward) ? r.reward[0] : r.reward
          const participant = Array.isArray(r.participant) ? r.participant[0] : r.participant
          const pts: number = reward?.required_points ?? 0
          const { icon, accent } = rewardTier(pts)
          return { id: r.id, icon, title: reward?.name ?? '---', recipient: participant?.name ?? '---', score: pts, accent }
        }))
      }

      if (tpRes.data) {
        setTopPrizesData(tpRes.data.map(r => {
          const pts: number = r.required_points ?? 0
          const { icon, accent } = rewardTier(pts)
          return { id: r.id, name: r.name, icon, requiredPoints: pts, accent }
        }))
      }
      setConfiguredRewardsCount(configuredRwRes.count ?? 0)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    if (gameStarted) fetchAll()
  }, [fetchAll, gameStarted])
  useEffect(() => {
    if (!gameStarted) return
    const t = setInterval(fetchAll, 30_000)
    return () => clearInterval(t)
  }, [fetchAll, gameStarted])

  // Realtime subscription: new participant_rewards INSERT → prepend to feed
  useEffect(() => {
    if (!eventId || !gameStarted) return
    const channel = supabase
      .channel(`kiosk_transactions_${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'point_transactions', filter: `event_id=eq.${eventId}` },
        () => { fetchAll() }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId, fetchAll, gameStarted])

  // Realtime subscription: new point_transactions INSERT -> refresh activity and leaderboards
  useEffect(() => {
    if (!eventId || !gameStarted) return
    const channel = supabase
      .channel(`kiosk_rewards_${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'participant_rewards', filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const id: string = (payload.new as { id: string }).id
          // Fetch joined data for the new row
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await supabase
            .from('participant_rewards')
            .select('id, awarded_at, reward:rewards(name, required_points), participant:participants(name)' as any)
            .eq('id', id)
            .single()
          if (!data) return
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = data as any
          const reward = Array.isArray(r.reward) ? r.reward[0] : r.reward
          const participant = Array.isArray(r.participant) ? r.participant[0] : r.participant
          const pts: number = reward?.required_points ?? 0
          const { icon, accent } = rewardTier(pts)
          const newRow: RewardRow = { id: r.id, icon, title: reward?.name ?? '---', recipient: participant?.name ?? '---', score: pts, accent }
          setRewardsData(prev => [newRow, ...prev].slice(0, 5))
          clearTimeout(newestClearTimer.current)
          setNewestRewardId(newRow.id)
          newestClearTimer.current = setTimeout(() => setNewestRewardId(null), 2200)
        }
      )
      .subscribe()
    return () => {
      clearTimeout(newestClearTimer.current)
      supabase.removeChannel(channel)
    }
  }, [eventId, gameStarted])

  const rankedGroups = useMemo<RankRow[]>(() => {
    const ranked = computeRanks(groupData)
    const maxPts = ranked[0]?.total_points || 1
    return ranked.slice(0, 4).map(g => ({
      id: g.group_id,
      name: g.group_name,
      initial: g.group_name.charAt(0),
      score: g.total_points,
      barPct: Math.round((g.total_points / maxPts) * 100),
      medal: (g.rank <= 3 ? g.rank : undefined) as 1 | 2 | 3 | undefined,
    }))
  }, [groupData])

  const topPlayers = useMemo<RankRow[]>(() => {
    const ranked = computeRanks(participantData)
    const maxPts = ranked[0]?.total_points || 1
    return ranked.slice(0, 4).map(p => ({
      id: p.participant_id,
      name: p.participant_name,
      initial: p.participant_name.charAt(0),
      score: p.total_points,
      barPct: Math.round((p.total_points / maxPts) * 100),
      medal: (p.rank <= 3 ? p.rank : undefined) as 1 | 2 | 3 | undefined,
    }))
  }, [participantData])

  const recentActivity = useMemo<ActivityRow[]>(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txData.slice(0, 10).map((tx: any) => {
      const action = Array.isArray(tx.action) ? tx.action[0] : tx.action
      const participant = Array.isArray(tx.participant) ? tx.participant[0] : tx.participant
      const visualKey = action?.id ?? tx.id
      return {
        id: tx.id,
        icon: activityIconForId(visualKey),
        title: action?.name ?? 'משימה',
        subtitle: participant?.name ?? '',
        points: tx.points > 0 ? `+${tx.points}` : String(tx.points),
        accent: activityAccentForId(visualKey),
        createdAt: tx.created_at ?? '',
      }
    })
  , [txData])

  const stats = useMemo<KioskStats>(() => ({
    totalMissions: txCount,
    totalPoints: txPointsTotal,
    totalGroups: groupData.length,
  }), [txCount, txPointsTotal, groupData.length])

  return {
    rankedGroups, topPlayers, recentActivity, rewards: rewardsData,
    topPrizes: topPrizesData, configuredRewardsCount, newestRewardId,
    actions: actionsData,
    kioskParticipants,
    actionCompletionIndex,
    stats, totalScans: txCount,
    loading, error, refetch: fetchAll,
  }
}

// ─── Decorative scanner frame (design-handoff spec) ──────────────────────────
function ScannerFrame({ processing }: { processing: boolean }) {
  return (
    <div className="kiosk-fadeUp" style={{ position: 'relative', width: 'clamp(260px, 28vw, 460px)', aspectRatio: '1 / 1', animationDelay: '0.1s' }}>
      {/* Rotating conic glow ring */}
      <div className="kiosk-hueRing" style={{
        position: 'absolute', inset: '-9%', borderRadius: '50%',
        background: 'conic-gradient(from 0deg,#FF9366,#F2B33C,#FFCB9A,#8FCFA0,#5FB3AA,#FF9366)',
        opacity: 0.20, filter: 'blur(9px)',
      }} />
      {/* Gradient border box */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 44,
        background: 'linear-gradient(135deg,#FF9366,#F2B33C 40%,#FFCB9A 70%,#8FCFA0)',
        padding: 5, boxShadow: '0 22px 60px rgba(171,53,0,0.16)',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 40, overflow: 'hidden',
          background: 'linear-gradient(160deg,#FFFFFF,#FFF1EC)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* Dot grid texture */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(255,147,102,0.09) 1.5px,transparent 1.6px)', backgroundSize: '26px 26px' }} />

          {/* QR card — brand-red CSS-grid matrix per design handoff */}
          <div className="kiosk-wobble" style={{
            background: '#fff', borderRadius: 20, padding: 16,
            boxShadow: '0 16px 40px rgba(171,53,0,0.18)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            position: 'relative', zIndex: 2,
          }}>
            <div style={{
              width: 'clamp(130px, 13vw, 200px)',
              height: 'clamp(130px, 13vw, 200px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(21, 1fr)',
              gridTemplateRows: 'repeat(21, 1fr)',
            }}>
              {QR_MATRIX.flat().map((v, i) => (
                <div key={i} style={{ background: v ? '#AB3500' : '#ffffff' }} />
              ))}
            </div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#7D706A' }}>כרטיס המשתתף</div>
          </div>

          {/* Corner brackets */}
          <div className="kiosk-blink" style={{ position: 'absolute', top: 20, right: 20, width: 46, height: 46, borderTop: '5px solid #FF9366', borderRight: '5px solid #FF9366', borderTopRightRadius: 14, boxShadow: '0 0 12px rgba(255,147,102,0.35)' }} />
          <div className="kiosk-blink" style={{ position: 'absolute', top: 20, left: 20, width: 46, height: 46, borderTop: '5px solid #F2B33C', borderLeft: '5px solid #F2B33C', borderTopLeftRadius: 14, boxShadow: '0 0 12px rgba(242,179,60,0.35)', animationDelay: '0.6s' }} />
          <div className="kiosk-blink" style={{ position: 'absolute', bottom: 20, right: 20, width: 46, height: 46, borderBottom: '5px solid #5FB3AA', borderRight: '5px solid #5FB3AA', borderBottomRightRadius: 14, boxShadow: '0 0 12px rgba(95,179,170,0.35)', animationDelay: '1.2s' }} />
          <div className="kiosk-blink" style={{ position: 'absolute', bottom: 20, left: 20, width: 46, height: 46, borderBottom: '5px solid #8FCFA0', borderLeft: '5px solid #8FCFA0', borderBottomLeftRadius: 14, boxShadow: '0 0 12px rgba(143,207,160,0.35)', animationDelay: '1.8s' }} />

          {/* Scan beam */}
          <div className="kiosk-scanY" style={{
            position: 'absolute', left: '7%', right: '7%', height: 3, borderRadius: 3,
            background: 'linear-gradient(90deg,transparent,#FF9366,#F2B33C,#FFB88A,transparent)',
            boxShadow: '0 0 12px 3px rgba(255,147,102,0.35)',
          }} />

          {/* Processing overlay */}
          {processing && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,248,243,0.75)', backdropFilter: 'blur(4px)',
            }}>
              <div className="kiosk-bob" style={{ fontSize: 40 }}>⏳</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Scan-success overlay (v2 design) ────────────────────────────────────────

const CONF_POPS = [
  { left: '15%', top: '22%', color: '#FF9366', size: 10 },
  { left: '75%', top: '18%', color: '#F2B33C', size: 8 },
  { left: '50%', top: '10%', color: '#5FB3AA', size: 9 },
  { left: '88%', top: '35%', color: '#8FCFA0', size: 11 },
  { left: '28%', top: '30%', color: '#FFB84D', size: 8 },
]

function ScanSuccessOverlay({
  result, onDismiss, reducedMotion,
}: {
  result: ScanResultDisplay | null
  onDismiss: () => void
  reducedMotion: boolean
}) {
  const [pointsShown, setPointsShown] = useState(0)

  useEffect(() => {
    if (!result) { setPointsShown(0); return }
    if (reducedMotion) { setPointsShown(result.points); return }
    const target = result.points
    let current = 0
    const iv = setInterval(() => {
      current += Math.max(1, Math.round(target / 14))
      if (current >= target) { current = target; clearInterval(iv) }
      setPointsShown(current)
    }, 45)
    return () => clearInterval(iv)
  }, [result, reducedMotion])

  if (!result) return null

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 46%,rgba(255,248,243,0.88),rgba(255,240,228,0.78) 56%,rgba(255,248,243,0.65) 84%)',
        backdropFilter: 'blur(3px)',
        cursor: 'pointer',
      }}
    >
      {/* Confetti pop burst */}
      {!reducedMotion && CONF_POPS.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.left, top: p.top,
          width: p.size, height: p.size, borderRadius: i % 2 === 0 ? '50%' : 4,
          background: p.color, opacity: 0,
          animation: `kiosk-confPop 1.0s ease-out ${i * 0.08}s both`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 30,
          padding: 'clamp(24px, 3vw, 40px) clamp(28px, 4vw, 48px)',
          border: '1.5px solid #FFE1CC',
          boxShadow: '0 34px 90px rgba(171,53,0,0.28), 0 8px 24px rgba(0,0,0,0.08)',
          width: 'clamp(300px, 30vw, 452px)',
          animation: reducedMotion ? 'none' : 'kiosk-cardBounceIn 0.5s cubic-bezier(0.2,0.9,0.25,1.2) both',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 'clamp(10px, 1.4vw, 18px)', textAlign: 'center',
        }}
      >
        {/* Green check disc */}
        <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
          {!reducedMotion && (
            <>
              <div style={{
                position: 'absolute', inset: -20, borderRadius: '50%',
                border: '3px solid rgba(62,158,107,0.5)',
                animation: 'kiosk-ringBurst 1.6s ease-out 0.3s infinite',
              }} />
              <div style={{
                position: 'absolute', inset: -10, borderRadius: '50%',
                border: '2px solid rgba(62,158,107,0.3)',
                animation: 'kiosk-ringBurst 1.6s ease-out 0.7s infinite',
              }} />
            </>
          )}
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: 'linear-gradient(135deg,#62C98A,#3E9E6B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(62,158,107,0.38)',
            animation: reducedMotion ? 'none' : 'kiosk-checkIn 0.55s cubic-bezier(0.2,0.9,0.25,1.1) 0.1s both',
          }}>
            <span style={{ color: '#fff', fontSize: 46, lineHeight: 1 }}>✓</span>
          </div>
        </div>

        {/* Label */}
        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 3, color: '#3E9E6B' }}>
          נסרק בהצלחה!
        </div>

        {/* Avatar + name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 58, height: 58, borderRadius: '50%',
              background: `linear-gradient(135deg,${result.tone},${result.tone}BB)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900, color: '#fff',
              boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
            }}>{result.initial}</div>
            <div style={{
              position: 'absolute',
              bottom: -5,
              right: -5,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#F2B33C,#FF9366)',
              border: '2px solid #FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              boxShadow: '0 4px 12px rgba(242,179,60,0.38)',
            }}>{result.emoji}</div>
          </div>
          <div style={{ fontWeight: 900, fontSize: 'clamp(18px, 2vw, 24px)', color: '#2E221E' }}>{result.name}</div>
        </div>

        {/* Action */}
        <div style={{ fontWeight: 800, fontSize: 15, color: '#7D706A', lineHeight: 1.3 }}>{result.action}</div>

        {/* Points pill with count-up */}
        <div className="kiosk-tickTap" style={{
          background: 'linear-gradient(135deg,#FF9366,#F2B33C)',
          color: '#fff', fontWeight: 900,
          fontSize: 'clamp(20px, 2.2vw, 28px)',
          padding: '10px 28px', borderRadius: 999,
          boxShadow: '0 6px 18px rgba(255,147,102,0.4)',
          minWidth: 120,
        }}>
          +{pointsShown} נק׳
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#3E8F88' }}>
          יש לך {result.totalPoints.toLocaleString('he-IL')} נקודות
        </div>
      </div>
    </div>
  )
}

// ─── Reward-celebration full-screen overlay (v2 design) ──────────────────────

function RewardCelebration({
  win, onDismiss, reducedMotion,
}: {
  win: RewardWinDisplay | null
  onDismiss: () => void
  reducedMotion: boolean
}) {
  if (!win) return null

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        overflow: 'hidden', cursor: 'pointer',
      }}
    >
      {/* Layer 1 — glow background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 46%,rgba(255,236,190,0.94),rgba(255,248,200,0.75) 60%,rgba(255,220,160,0.85) 100%)',
        animation: reducedMotion ? 'none' : 'kiosk-glowPulse 2.4s ease-in-out infinite',
      }} />

      {/* Layer 2 — rotating rays */}
      {!reducedMotion && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 1050, height: 1050,
          marginLeft: -525, marginTop: -525,
          background: 'repeating-conic-gradient(rgba(255,200,100,0.22) 0deg 10deg, transparent 10deg 20deg)',
          WebkitMask: 'radial-gradient(closest-side, transparent 20%, #000 44%, transparent 72%)',
          mask: 'radial-gradient(closest-side, transparent 20%, #000 44%, transparent 72%)',
          animation: 'kiosk-rayspin 24s linear infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Layer 3 — confetti rain */}
      {!reducedMotion && CONFETTI_PARTICLES.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: -20,
          left: `${p.left}%`,
          width: p.size, height: p.size,
          borderRadius: p.isCircle ? '50%' : 4,
          background: p.color,
          transform: `rotate(${p.rotation}deg)`,
          animation: `kiosk-confettiFall ${p.duration}s ease-in ${p.delay}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Layer 4 — coin burst from center */}
      {!reducedMotion && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none' }}>
          {COIN_PARTICLES.map(c => (
            <div key={c.id} style={{
              position: 'absolute', fontSize: 24,
              // @ts-expect-error CSS custom properties
              '--tx': `${c.tx}px`,
              '--ty': `${c.ty}px`,
              animation: `kiosk-coinBurst ${c.duration}s ease-out ${c.delay}s both`,
            }}>🪙</div>
          ))}
        </div>
      )}

      {/* Layer 5 — center content */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
          padding: '0 20px',
        }}
      >
        {/* Congrats title */}
        <div style={{
          fontSize: 'clamp(40px, 5.5vw, 64px)',
          fontWeight: 900,
          background: 'linear-gradient(135deg,#FF7A2E,#F2A03C,#E8B23C)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: reducedMotion ? 'none' : 'kiosk-congratsIn 0.8s cubic-bezier(0.2,0.9,0.25,1.1) both',
          textAlign: 'center',
        }}>🎉 מזל טוב! 🎉</div>

        {/* Reward card */}
        <div style={{
          position: 'relative',
          width: 'clamp(280px, 30vw, 440px)',
          background: '#FFFEF5', borderRadius: 34,
          border: '2px solid #FFDFA6',
          boxShadow: '0 24px 80px rgba(242,160,60,0.38), 0 8px 24px rgba(0,0,0,0.12), 0 0 0 4px rgba(255,255,255,0.8)',
          padding: 'clamp(20px, 2.5vw, 36px) clamp(24px, 3vw, 40px)',
          animation: reducedMotion ? 'none' : 'kiosk-rewardPop 0.8s cubic-bezier(0.2,0.9,0.25,1.1) 0.2s both',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 12, textAlign: 'center',
        }}>
          {/* Sparkle corners */}
          <div className="kiosk-twinkle" style={{ '--kiosk-r': '15deg', position: 'absolute', top: 14, right: 18, fontSize: 18 } as React.CSSProperties}>✨</div>
          <div className="kiosk-twinkle" style={{ '--kiosk-r': '-20deg', position: 'absolute', top: 14, left: 18, fontSize: 16, animationDelay: '0.5s' } as React.CSSProperties}>⭐</div>
          <div className="kiosk-twinkle" style={{ '--kiosk-r': '10deg', position: 'absolute', bottom: 14, right: 20, fontSize: 16, animationDelay: '1s' } as React.CSSProperties}>✨</div>
          <div className="kiosk-twinkle" style={{ '--kiosk-r': '-15deg', position: 'absolute', bottom: 14, left: 18, fontSize: 18, animationDelay: '0.7s' } as React.CSSProperties}>⭐</div>

          {/* Medal disc */}
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            background: 'linear-gradient(135deg,#FDE068,#F2B33C,#C8890B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60,
            boxShadow: '0 8px 28px rgba(242,179,60,0.5), 0 0 0 6px rgba(255,228,100,0.3)',
            animation: reducedMotion ? 'none' : 'kiosk-medalSpin 3.4s ease-in-out 0.6s infinite',
          }}>{win.emoji}</div>

          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 2, color: '#C8890B' }}>זכייה בפרס</div>
          <div style={{ fontSize: 'clamp(22px, 2.8vw, 34px)', fontWeight: 900, color: '#2E221E', lineHeight: 1.2 }}>{win.title}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#7D706A' }}>{win.sub}</div>

          {/* Points pill */}
          <div className="kiosk-tickTap" style={{
            background: 'linear-gradient(135deg,#FF9366,#F2B33C)',
            color: '#fff', fontWeight: 900, fontSize: 22,
            padding: '10px 28px', borderRadius: 999,
            boxShadow: '0 6px 18px rgba(255,147,102,0.4)',
          }}>{win.points.toLocaleString('he-IL')} נק׳</div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlowingStarsOrange() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div className="kiosk-twinkle kiosk-floatY-1" style={{ position: 'absolute', top: 8, right: 9, fontSize: 16, filter: 'drop-shadow(0 0 6px rgba(255,244,214,0.95))' }}>✨</div>
      <div className="kiosk-twinkle kiosk-floatY-2" style={{ position: 'absolute', top: 150, left: 6, fontSize: 13, filter: 'drop-shadow(0 0 6px rgba(255,244,214,0.95))' }}>⭐</div>
      <div className="kiosk-twinkle" style={{ position: 'absolute', top: 360, right: 6, width: 7, height: 7, borderRadius: '50%', background: '#fff', boxShadow: '0 0 9px 2px rgba(255,255,255,0.9)' }} />
      <div className="kiosk-twinkle kiosk-floatY-3" style={{ position: 'absolute', top: 520, left: 8, fontSize: 14, filter: 'drop-shadow(0 0 6px rgba(255,244,214,0.95))' }}>✨</div>
      <div className="kiosk-twinkle kiosk-floatY-4" style={{ position: 'absolute', bottom: 120, right: 7, fontSize: 13, filter: 'drop-shadow(0 0 6px rgba(255,244,214,0.95))' }}>⭐</div>
      <div className="kiosk-twinkle" style={{ position: 'absolute', bottom: 30, left: 11, width: 6, height: 6, borderRadius: '50%', background: '#fff', boxShadow: '0 0 8px 2px rgba(255,255,255,0.85)' }} />
    </div>
  )
}

function GlowingStarsTeal() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div className="kiosk-twinkle kiosk-floatY-4" style={{ position: 'absolute', top: 70, left: 20, fontSize: 18, filter: 'drop-shadow(0 0 7px rgba(255,255,255,0.95))' }}>✨</div>
      <div className="kiosk-twinkle kiosk-floatY-2" style={{ position: 'absolute', top: 150, right: 16, fontSize: 14, filter: 'drop-shadow(0 0 7px rgba(255,246,214,0.95))' }}>⭐</div>
      <div className="kiosk-twinkle" style={{ position: 'absolute', top: 250, left: 14, width: 7, height: 7, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px 2px rgba(255,255,255,0.9)' }} />
      <div className="kiosk-twinkle kiosk-floatY-3" style={{ position: 'absolute', bottom: 150, right: 22, fontSize: 16, filter: 'drop-shadow(0 0 7px rgba(255,246,214,0.95))' }}>✨</div>
      <div className="kiosk-twinkle kiosk-floatY-1" style={{ position: 'absolute', bottom: 70, left: 24, fontSize: 14, filter: 'drop-shadow(0 0 7px rgba(255,255,255,0.95))' }}>⭐</div>
      <div className="kiosk-twinkle" style={{ position: 'absolute', top: 330, right: 18, width: 6, height: 6, borderRadius: '50%', background: '#fff', boxShadow: '0 0 8px 2px rgba(255,255,255,0.85)' }} />
    </div>
  )
}

function LivePill() {
  return (
    <span className="kiosk-tickTap" style={{
      background: 'linear-gradient(135deg,#FF9366,#F2B33C)', color: '#fff',
      fontWeight: 900, fontSize: 12, padding: '5px 14px', borderRadius: 999,
      boxShadow: '0 4px 12px rgba(0,0,0,0.16)', display: 'inline-block',
    }}>לייב</span>
  )
}

function TopPrizes({ prizes }: { prizes: TopPrizeRow[] }) {
  if (prizes.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.85)' }}>✦ הפרסים הגדולים</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {prizes.map((p, i) => {
          const isTop = i === 0
          return (
            <div key={p.id} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 6px', borderRadius: 14, textAlign: 'center',
              background: isTop ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.15)',
              border: isTop ? '2px solid #F2B33C' : '1.5px solid rgba(255,255,255,0.25)',
              boxShadow: isTop ? '0 4px 14px rgba(242,179,60,0.25)' : 'none',
            }}>
              <span style={{ fontSize: isTop ? 28 : 22 }}>{p.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2 }}>{p.name}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: isTop ? '#F2B33C' : 'rgba(255,255,255,0.9)' }}>
                {p.requiredPoints.toLocaleString('he-IL')} נק׳
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AwardedRewardsFeed({ rewards, newestId }: { rewards: RewardRow[]; newestId: string | null }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Section label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span className="kiosk-blink" style={{ width: 8, height: 8, borderRadius: '50%', background: '#F2B33C', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '1px', color: 'rgba(255,255,255,0.9)' }}>זכו זה עתה 🎉</span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rewards.map((r, i) => {
          const isNew = r.id === newestId
          return (
            <div
              key={r.id}
              className={isNew ? 'kiosk-rewardIn kiosk-goldPulse' : 'kiosk-fadeUp'}
              style={{
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 14, background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(4px)',
                border: isNew ? '1.5px solid rgba(242,179,60,0.6)' : '1px solid rgba(255,255,255,0.28)',
                animationDelay: isNew ? '0s' : `${0.05 + i * 0.07}s`,
              }}
            >
              {/* Shimmer sweep — only on newest row, one-shot */}
              {isNew && (
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
                }}>
                  <div className="kiosk-shimmerSweep" style={{
                    position: 'absolute', top: 0, bottom: 0, width: '40%',
                    background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)',
                    animationIterationCount: 1,
                  }} />
                </div>
              )}

              {/* Icon in gold disc */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,#F2B33C,#E09A1F)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, boxShadow: '0 3px 10px rgba(242,179,60,0.4)',
              }}>
                {r.icon}
              </div>

              {/* Title + recipient */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.78)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.recipient}</div>
              </div>

              {/* Points pill */}
              <div style={{
                flexShrink: 0, padding: '4px 10px', borderRadius: 999,
                background: 'linear-gradient(135deg,#F2B33C,#C8890B)',
                color: '#fff', fontWeight: 900, fontSize: 13,
                boxShadow: '0 2px 8px rgba(242,179,60,0.35)',
              }}>
                {r.score.toLocaleString('he-IL')} נק׳
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Right panel views ────────────────────────────────────────────────────────

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="kiosk-skeleton"
          style={{
            height: i === 0 ? 56 : 50,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.22)',
            opacity: 0.82 - i * 0.12,
          }}
        />
      ))}
    </div>
  )
}

function MissionPreGamePanel() {
  return (
    <>
      <div className="kiosk-fadeUp kiosk-cardBreathe" style={{
        position: 'relative', zIndex: 1, borderRadius: 22, padding: 22,
        background: '#FFFFFF', boxShadow: '0 10px 24px rgba(120,50,10,0.18)',
        color: '#2E221E', border: '1.5px solid #FFD8BC', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div className="kiosk-shimmerSweep" style={{ position: 'absolute', top: 0, bottom: 0, width: '42%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.58),transparent)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div className="kiosk-bob" style={{ fontSize: 46, lineHeight: 1 }}>🎯</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: '#E07A3E' }}>משימה ראשונה</div>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2, marginTop: 3 }}>השלימו את המשימה הראשונה</div>
          </div>
        </div>
        <div style={{ position: 'relative', marginTop: 14, color: '#7D706A', fontSize: 15, fontWeight: 800, lineHeight: 1.45 }}>
          כל סריקה פותחת נקודות ופרסים.
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
        <SkeletonRows count={4} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.9)' }}>
        ✨ הפעילות תופיע כאן ברגע שתתחילו
      </div>
    </>
  )
}

function RewardsPreGameFeed() {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        borderRadius: 18,
        background: 'rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.28)',
        padding: '18px 16px',
        textAlign: 'center',
        color: '#FFFFFF',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
      }}>
        <div style={{ fontSize: 32, lineHeight: 1 }}>🎉</div>
        <div style={{ marginTop: 8, fontSize: 17, fontWeight: 900, lineHeight: 1.3 }}>
          עדיין לא חולקו פרסים
        </div>
        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.82)' }}>
          היו הראשונים לזכות!
        </div>
      </div>
      <SkeletonRows count={2} />
    </div>
  )
}

function RewardsStartedEmptyFeed() {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        borderRadius: 18,
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.32)',
        padding: '18px 16px',
        textAlign: 'center',
        color: '#FFFFFF',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
      }}>
        <div style={{ fontSize: 32, lineHeight: 1 }}>🏆</div>
        <div style={{ marginTop: 8, fontSize: 17, fontWeight: 900, lineHeight: 1.3 }}>
          עוד רגע נראה כאן זוכים
        </div>
        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.84)', lineHeight: 1.35 }}>
          כל משימה שתושלם מקרבת את המשתתפים לפרס הבא.
        </div>
      </div>
      <SkeletonRows count={2} />
    </div>
  )
}

function RewardsActiveNoAwardsFeed() {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        borderRadius: 18,
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.32)',
        padding: '18px 16px',
        textAlign: 'center',
        color: '#FFFFFF',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
      }}>
        <div style={{ fontSize: 32, lineHeight: 1 }}>🏁</div>
        <div style={{ marginTop: 8, fontSize: 17, fontWeight: 900, lineHeight: 1.3 }}>
          המרוץ לפרסים כבר התחיל
        </div>
        <div style={{ marginTop: 5, fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.86)', lineHeight: 1.35 }}>
          המשתתפים כבר צוברים נקודות. עוד קצת, והפרס הראשון ייפתח!
        </div>
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.76)', lineHeight: 1.35 }}>
          ברגע שמישהו יגיע ליעד הניקוד, הזכייה תופיע כאן בזמן אמת.
        </div>
      </div>
      <SkeletonRows count={2} />
    </div>
  )
}

function RewardsNotConfiguredState({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="kiosk-fadeUp kiosk-cardBreathe" style={{
        borderRadius: 18,
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.32)',
        padding: '18px 16px',
        textAlign: 'center',
        color: '#FFFFFF',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
        overflow: 'hidden',
      }}>
        <div className="kiosk-bob" style={{ fontSize: 34, lineHeight: 1 }}>🎁</div>
        <div style={{ marginTop: 9, fontSize: 17, fontWeight: 900, lineHeight: 1.3 }}>
          הפרס הראשון מתחיל כאן
        </div>
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.86)', lineHeight: 1.42 }}>
          צרו את הפרס הראשון והפכו כל נקודה לרגע של התרגשות.
        </div>
        <button
          onClick={onCreate}
          style={{
            marginTop: 14,
            border: 'none',
            borderRadius: 999,
            background: 'linear-gradient(135deg,#F2B33C,#FF9366)',
            color: '#FFFFFF',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 900,
            padding: '10px 18px',
            boxShadow: '0 6px 16px rgba(242,179,60,0.28)',
          }}
        >
          יצירת הפרס הראשון
        </button>
      </div>
      <SkeletonRows count={2} />
    </div>
  )
}

function StartedNoActivityState() {
  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      gap: 14,
    }}>
      <div className="kiosk-fadeUp" style={{
        borderRadius: 18,
        background: 'rgba(255,255,255,0.22)',
        border: '1px solid rgba(255,255,255,0.32)',
        padding: '20px 18px',
        textAlign: 'center',
        color: '#FFFFFF',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
      }}>
        <div className="kiosk-bob" style={{ fontSize: 36, lineHeight: 1 }}>🎯</div>
        <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900, lineHeight: 1.25 }}>
          הלוח מחכה לפעולה הראשונה
        </div>
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.84)', lineHeight: 1.45 }}>
          ברגע שתתבצע הסריקה הראשונה, המשימות יתחילו להתמלא כאן בזמן אמת.
        </div>
      </div>
      <SkeletonRows count={3} />
    </div>
  )
}

const ACTIVITY_MAX_SLOTS = 10
const ACTIVITY_ROTATE_MS = 4_200
const ACTIVITY_ROW_EST_HEIGHT = 52
const ACTIVITY_ROW_GAP = 7
const ACTIVITY_ROW_STEP = ACTIVITY_ROW_EST_HEIGHT + ACTIVITY_ROW_GAP
const ACTIVITY_SPOTLIGHT_MS = 60_000
const ACTIVITY_CELEBRATE_MS = 3_500
const ACTIVITY_STRIP_MS = 8_000
const ACTIVITY_STRIP_OUT_MS = 400
const SCAN_SUCCESS_MS = 4200

const SPOTLIGHT_SPARKS = [
  { x: -38, y: -30, color: '#FF9366', delay: 0, size: 9 },
  { x: 44, y: -26, color: '#F2B33C', delay: 0.04, size: 8 },
  { x: -30, y: 28, color: '#5FB3AA', delay: 0.08, size: 7 },
  { x: 36, y: 32, color: '#FF7350', delay: 0.02, size: 10 },
  { x: 0, y: -40, color: '#FFD68A', delay: 0.06, size: 8 },
  { x: -48, y: 4, color: '#8FCFA0', delay: 0.1, size: 7 },
  { x: 50, y: 8, color: '#FFB84D', delay: 0.03, size: 9 },
  { x: 18, y: -34, color: '#FF9366', delay: 0.07, size: 6 },
] as const

function SpotlightCelebrationFX({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null
  return (
    <div className="kiosk-activityCelebrateFx" aria-hidden="true">
      <div className="kiosk-activityBurstRing kiosk-activityBurstRing--1" />
      <div className="kiosk-activityBurstRing kiosk-activityBurstRing--2" />
      {SPOTLIGHT_SPARKS.map((s, i) => (
        <span
          key={i}
          className="kiosk-activitySpark"
          style={{
            ['--sx' as string]: `${s.x}px`,
            ['--sy' as string]: `${s.y}px`,
            width: s.size,
            height: s.size,
            background: s.color,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

function ActivityPointsBadge({
  points, celebrate = false, reducedMotion = false, motion,
}: {
  points: string
  celebrate?: boolean
  reducedMotion?: boolean
  motion?: ReturnType<typeof activityRowMotionForId>
}) {
  return (
    <div
      className={[
        celebrate ? 'kiosk-activityPointsCelebrate' : '',
        !celebrate && !reducedMotion ? 'kiosk-activityPointsPulse' : '',
      ].filter(Boolean).join(' ') || undefined}
      style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
      background: 'linear-gradient(145deg,#FFFFFF,#FFF4E0)',
      border: celebrate ? '2px solid rgba(242,179,60,0.95)' : '1.5px solid rgba(242,179,60,0.75)',
      borderRadius: 999,
      padding: celebrate ? '3px 7px 3px 5px' : '2px 6px 2px 4px',
      boxShadow: celebrate ? '0 4px 16px rgba(242,179,60,0.45)' : undefined,
      ...(motion && !celebrate && !reducedMotion ? {
        ['--kiosk-points-dur' as string]: motion.pointsDuration,
        ['--kiosk-points-delay' as string]: motion.pointsDelay,
      } : {}),
    }}>
      <span
        className={celebrate ? 'kiosk-fireFlicker' : undefined}
        style={{
          fontSize: celebrate ? 11 : 9,
          lineHeight: 1,
          filter: 'drop-shadow(0 0 4px rgba(242,179,60,0.5))',
        }}
      >
        ⭐
      </span>
      <span
        className={celebrate ? 'kiosk-numberGlow' : undefined}
        style={{
        display: 'inline-flex', direction: 'ltr', alignItems: 'baseline',
        fontSize: celebrate ? 14 : 12, fontWeight: 900, color: '#C8941A', lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {points}
      </span>
    </div>
  )
}

function ActivityCard({
  row, spotlight = false, celebrating = false, now, reducedMotion = false,
}: {
  row: ActivityRow
  spotlight?: boolean
  celebrating?: boolean
  now: Date
  reducedMotion?: boolean
}) {
  const relativeTime = formatActivityRelativeTime(row.createdAt, now)
  const motion = activityRowMotionForId(row.id)
  const iconClass = celebrating && !reducedMotion
    ? 'kiosk-activityIconCelebrate'
    : spotlight && !reducedMotion
      ? 'kiosk-activityIconPulse'
      : !reducedMotion
        ? 'kiosk-activityIconSpin'
        : undefined
  return (
    <div className="kiosk-activityRowContent">
      <span
        className={iconClass}
        style={{
          fontSize: celebrating ? 22 : 18,
          lineHeight: 1,
          flexShrink: 0,
          display: 'inline-block',
          ...(iconClass === 'kiosk-activityIconSpin' ? {
            ['--kiosk-icon-dur' as string]: motion.iconDuration,
            ['--kiosk-icon-delay' as string]: motion.iconDelay,
          } : {}),
        }}
      >
        {row.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }} className="kiosk-activityRowText">
        <div
          className={[
            'kiosk-activityRowTitle',
            celebrating ? 'kiosk-activityTitleCelebrate' : '',
          ].filter(Boolean).join(' ') || undefined}
          style={{ fontWeight: 900, fontSize: 13, color: '#2E221E' }}
        >
          {row.title}
        </div>
        <div className="kiosk-activityRowSubtitle">
          <span className="kiosk-activityRowName">{row.subtitle}</span>
          {relativeTime && (
            <>
              <span className="kiosk-activityRowMetaSep"> · </span>
              <span className="kiosk-activityRowTime">{relativeTime}</span>
            </>
          )}
        </div>
      </div>
      <ActivityPointsBadge
        points={row.points}
        celebrate={celebrating || spotlight}
        reducedMotion={reducedMotion}
        motion={motion}
      />
    </div>
  )
}

function ActivityView({
  rows, active, reducedMotion = false,
}: {
  rows: ActivityRow[]
  active: boolean
  reducedMotion?: boolean
}) {
  const hasRows = rows.length > 0
  const listRef = useRef<HTMLDivElement>(null)
  const [fitSlots, setFitSlots] = useState(ACTIVITY_MAX_SLOTS)
  const slots = Math.min(fitSlots, ACTIVITY_MAX_SLOTS, rows.length)
  const [visibleIndices, setVisibleIndices] = useState<number[]>([])
  const [phase, setPhase] = useState<'idle' | 'push'>('idle')
  const [pushReason, setPushReason] = useState<'new' | 'rotate'>('new')
  const [rotateIncomingIdx, setRotateIncomingIdx] = useState<number | null>(null)
  const [pushSnapshot, setPushSnapshot] = useState<{
    newRows: ActivityRow[]
    previousVisible: ActivityRow[]
  } | null>(null)
  const [spotlightUntil, setSpotlightUntil] = useState<Record<string, number>>({})
  const [celebratingIds, setCelebratingIds] = useState<Set<string>>(() => new Set())
  const [stripIds, setStripIds] = useState<Set<string>>(() => new Set())
  const [stripExitingIds, setStripExitingIds] = useState<Set<string>>(() => new Set())
  const [now, setNow] = useState(() => Date.now())
  const prevRowIdsRef = useRef<Set<string> | null>(null)
  const celebratedOnceRef = useRef<Set<string>>(new Set())
  const enterClearTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const seedExistingRows = useCallback((ids: string[]) => {
    prevRowIdsRef.current = new Set(ids)
    for (const id of ids) {
      celebratedOnceRef.current.add(id)
    }
  }, [])

  useEffect(() => () => {
    enterClearTimersRef.current.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el || !hasRows) return

    const measure = () => {
      const height = el.getBoundingClientRect().height
      if (height <= 0) return
      const fullRows = Math.floor((height + ACTIVITY_ROW_GAP) / ACTIVITY_ROW_STEP)
      const usedByFull = fullRows > 0
        ? fullRows * ACTIVITY_ROW_EST_HEIGHT + (fullRows - 1) * ACTIVITY_ROW_GAP
        : 0
      const remaining = height - usedByFull
      const fit = remaining > 0 ? fullRows + 1 : fullRows
      setFitSlots(Math.max(1, Math.min(ACTIVITY_MAX_SLOTS, fit)))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasRows])

  const resetVisibleIndices = useCallback(() => {
    setVisibleIndices(Array.from({ length: slots }, (_, i) => i))
  }, [slots])

  useEffect(() => {
    resetVisibleIndices()
  }, [rows.length, slots, resetVisibleIndices])

  useEffect(() => {
    const prev = prevRowIdsRef.current
    const currentIds = rows.map((r) => r.id)

    if (prev === null) {
      seedExistingRows(currentIds)
      return
    }

    // Data arrived after initial empty state — treat as baseline, not new scans.
    if (prev.size === 0 && currentIds.length > 0) {
      seedExistingRows(currentIds)
      return
    }

    const ts = Date.now()
    const updates: Record<string, number> = {}
    let hasNew = false
    for (const row of rows) {
      if (!prev.has(row.id)) {
        if (celebratedOnceRef.current.has(row.id)) continue
        hasNew = true
        updates[row.id] = ts + ACTIVITY_SPOTLIGHT_MS
      }
    }
    prevRowIdsRef.current = new Set(currentIds)
    if (hasNew) {
      const newIds = new Set(Object.keys(updates))
      const newRows = rows.filter((r) => newIds.has(r.id))
      const previousVisible = rows.filter((r) => !newIds.has(r.id)).slice(0, slots)
      setRotateIncomingIdx(null)
      resetVisibleIndices()
      setPushReason('new')
      setPushSnapshot({ newRows, previousVisible })
      setPhase('push')
      setSpotlightUntil((su) => ({ ...su, ...updates }))
      setCelebratingIds((prevCelebrating) => {
        const next = new Set(prevCelebrating)
        for (const id of Object.keys(updates)) next.add(id)
        return next
      })
      setStripIds((prevStrip) => {
        const next = new Set(prevStrip)
        for (const id of Object.keys(updates)) next.add(id)
        return next
      })
      for (const id of Object.keys(updates)) {
        const celebrateTimer = setTimeout(() => {
          celebratedOnceRef.current.add(id)
          setCelebratingIds((prevCelebrating) => {
            if (!prevCelebrating.has(id)) return prevCelebrating
            const next = new Set(prevCelebrating)
            next.delete(id)
            return next
          })
        }, ACTIVITY_CELEBRATE_MS)
        enterClearTimersRef.current.push(celebrateTimer)

        const stripTimer = setTimeout(() => {
          setStripExitingIds((prevExiting) => {
            const next = new Set(prevExiting)
            next.add(id)
            return next
          })
          const stripOutTimer = setTimeout(() => {
            setStripIds((prevStrip) => {
              if (!prevStrip.has(id)) return prevStrip
              const next = new Set(prevStrip)
              next.delete(id)
              return next
            })
            setStripExitingIds((prevExiting) => {
              if (!prevExiting.has(id)) return prevExiting
              const next = new Set(prevExiting)
              next.delete(id)
              return next
            })
          }, ACTIVITY_STRIP_OUT_MS)
          enterClearTimersRef.current.push(stripOutTimer)
        }, ACTIVITY_STRIP_MS)
        enterClearTimersRef.current.push(stripTimer)
      }
    }
  }, [rows, seedExistingRows, slots])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const isSpotlightRow = useCallback(
    (id: string) => (spotlightUntil[id] ?? 0) > now,
    [spotlightUntil, now],
  )

  const hasRecentActivity = useMemo(() => {
    const newest = rows[0]?.createdAt
    if (!newest) return false
    const created = new Date(newest)
    if (Number.isNaN(created.getTime())) return false
    return now - created.getTime() < 60_000
  }, [rows, now])

  const canRotate = hasRows
    && !hasRecentActivity
    && rows.length > slots
    && !reducedMotion

  useEffect(() => {
    if (hasRecentActivity) resetVisibleIndices()
  }, [hasRecentActivity, resetVisibleIndices])

  useEffect(() => {
    if (!canRotate || phase === 'push' || visibleIndices.length < slots) return
    const t = window.setInterval(() => {
      const bottomIdx = visibleIndices[slots - 1]
      const incomingIdx = (bottomIdx + 1) % rows.length
      setRotateIncomingIdx(incomingIdx)
      setPushReason('rotate')
      setPhase('push')
    }, ACTIVITY_ROTATE_MS)
    return () => window.clearInterval(t)
  }, [canRotate, phase, visibleIndices, slots, rows.length])

  useEffect(() => {
    if (phase !== 'push') return
    const t = window.setTimeout(() => {
      if (pushReason === 'rotate' && rotateIncomingIdx !== null) {
        setVisibleIndices((prev) => [rotateIncomingIdx, ...prev.slice(0, slots - 1)])
        setRotateIncomingIdx(null)
      } else {
        resetVisibleIndices()
      }
      setPushSnapshot(null)
      setPhase('idle')
    }, reducedMotion ? 0 : 720)
    return () => window.clearTimeout(t)
  }, [phase, pushReason, rotateIncomingIdx, rows.length, slots, reducedMotion, resetVisibleIndices])

  const stackRows = useMemo(() => {
    let items: { row: ActivityRow; spotlight: boolean }[]
    if (phase === 'push' && pushReason === 'new' && pushSnapshot) {
      items = [
        ...pushSnapshot.newRows.map((row) => ({ row, spotlight: true })),
        ...pushSnapshot.previousVisible.map((row) => ({ row, spotlight: false })),
      ]
    } else if (phase === 'push' && pushReason === 'rotate' && rotateIncomingIdx !== null) {
      const current = visibleIndices.slice(0, slots).map((idx) => ({
        row: rows[idx],
        spotlight: false,
      }))
      items = [{ row: rows[rotateIncomingIdx], spotlight: false }, ...current]
    } else if (hasRecentActivity) {
      items = rows.slice(0, slots).map((row) => ({
        row,
        spotlight: isSpotlightRow(row.id),
      }))
    } else {
      items = visibleIndices.slice(0, slots).map((idx) => ({
        row: rows[idx],
        spotlight: false,
      }))
    }
    return items.map((item, visualIndex) => ({
      ...item,
      visualIndex,
    }))
  }, [hasRecentActivity, isSpotlightRow, slots, phase, pushReason, pushSnapshot, rotateIncomingIdx, visibleIndices, rows])

  const topStripRow = useMemo(() => {
    for (const item of stackRows) {
      if (item.visualIndex === 0 && stripIds.has(item.row.id)) return item
    }
    return null
  }, [stackRows, stripIds])

  const style: React.CSSProperties = {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 9,
    transition: 'opacity 0.6s ease, transform 0.6s ease',
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0)' : 'translateY(-10px)',
    pointerEvents: active ? 'auto' : 'none',
    overflow: 'visible',
  }

  return (
    <div style={style}>
      {hasRows && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <span className="kiosk-blink" style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFFFFF', display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '1.5px', color: '#FFFFFF' }}>פעילות אחרונה</span>
        </div>
      )}
      {!hasRows ? (
        <StartedNoActivityState />
      ) : (
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {!reducedMotion && topStripRow && (
            <div className="kiosk-activityCelebrateStripAnchor" aria-hidden="true">
              <div
                className={[
                  'kiosk-activityCelebrateStrip',
                  stripExitingIds.has(topStripRow.row.id) ? 'kiosk-activityCelebrateStrip--out' : '',
                ].filter(Boolean).join(' ')}
              >
                ✓ משימה בוצעה!
              </div>
            </div>
          )}
          <div
            ref={listRef}
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            ['--kiosk-activity-row-step' as string]: `${ACTIVITY_ROW_STEP}px`,
            }}
          >
          <div
            className={phase === 'push' && !reducedMotion ? 'kiosk-activityStackPush' : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: ACTIVITY_ROW_GAP, flexShrink: 0 }}
          >
            {stackRows.map(({ row: r, spotlight, visualIndex }) => {
              const isPush = phase === 'push' && !reducedMotion
              const pushCount = stackRows.length
              const isEntering = isPush && visualIndex === 0
              const celebrating = spotlight && celebratingIds.has(r.id)
              const rowClasses = [
                'kiosk-activityRow',
                spotlight ? 'kiosk-activityRow--spotlight' : '',
                celebrating && !reducedMotion && !isEntering ? 'kiosk-activityCelebrateIn' : '',
                spotlight && !celebrating && !reducedMotion ? 'kiosk-activitySpotlightLive' : '',
                isEntering ? 'kiosk-activityEnterSide' : '',
                isPush && visualIndex === pushCount - 1 && pushCount > slots ? 'kiosk-activityExitBottom' : '',
              ].filter(Boolean).join(' ')
              const rowKey = phase === 'push' && pushReason === 'rotate'
                ? `${rotateIncomingIdx}-${r.id}-${visualIndex}`
                : r.id
              return (
              <div
                key={rowKey}
                className={rowClasses}
                style={{
                  '--kiosk-row-accent': r.accent,
                } as React.CSSProperties}
              >
                {celebrating && !reducedMotion && <SpotlightCelebrationFX reducedMotion={reducedMotion} />}
                <ActivityCard
                  row={r}
                  spotlight={spotlight}
                  celebrating={celebrating}
                  now={new Date(now)}
                  reducedMotion={reducedMotion}
                />
              </div>
              )
            })}
          </div>
          </div>
        </div>
      )}
    </div>
  )
}


const MISSION_ROTATE_MS = 15_000

function FloatingPointsBadge({
  action,
  reducedMotion,
  swapPhase,
}: {
  action: KioskAction | null
  reducedMotion: boolean
  swapPhase: 'idle' | 'out' | 'in'
}) {
  const [showPoints, setShowPoints] = useState(reducedMotion)
  const actionId = action?.id ?? null

  useEffect(() => {
    if (reducedMotion) {
      setShowPoints(true)
      return
    }
    if (swapPhase !== 'idle') {
      setShowPoints(false)
      return
    }
    setShowPoints(false)
    const t = window.setTimeout(() => setShowPoints(true), 720)
    return () => window.clearTimeout(t)
  }, [actionId, reducedMotion, swapPhase])

  const points = action?.points ?? null

  const pillStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'linear-gradient(145deg,#FFFFFF,#FFF4E0)',
    border: '2.5px solid rgba(242,179,60,0.9)', borderRadius: 999,
    padding: '7px 14px 7px 10px',
    boxShadow: '0 10px 28px rgba(242,179,60,0.48), 0 0 0 4px rgba(255,255,255,0.95), 0 0 24px rgba(242,179,60,0.32)',
    whiteSpace: 'nowrap',
  }

  if (!showPoints) return null

  return (
    <div style={{ position: 'absolute', bottom: -14, left: -26, zIndex: 30 }}>
      <div
        key={actionId ?? 'none'}
        className={reducedMotion ? undefined : 'kiosk-pointsFlyIn'}
        style={pillStyle}
      >
        <span className="kiosk-fireFlicker" style={{ fontSize: 14, lineHeight: 1, filter: 'drop-shadow(0 0 6px rgba(242,179,60,0.7))' }}>
          ⭐
        </span>
        <span
          className="kiosk-numberGlow"
          style={{
            display: 'inline-flex', direction: 'ltr', alignItems: 'baseline',
            fontSize: 28, fontWeight: 900, color: '#C8941A', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}
        >
          {points === null ? '---' : (
            <>
              {points > 0 && '+'}
              {points}
            </>
          )}
        </span>
      </div>
    </div>
  )
}


const MISSION_SWAP_EXIT_MS = 480
const MISSION_SWAP_ENTER_MS = 800

const MISSION_SWAP_SPARKS = [
  { msx: '-58px', msy: '-42px', size: 9, color: '#FF9366', delay: '0.06s' },
  { msx: '62px', msy: '-36px', size: 7, color: '#F2B33C', delay: '0.1s' },
  { msx: '-44px', msy: '48px', size: 8, color: '#FFB84D', delay: '0.08s' },
  { msx: '52px', msy: '44px', size: 6, color: '#FF7030', delay: '0.12s' },
  { msx: '0px', msy: '-58px', size: 7, color: '#FFD68A', delay: '0.04s' },
  { msx: '-68px', msy: '8px', size: 5, color: '#E88530', delay: '0.14s' },
] as const

type MissionSwapPhase = 'idle' | 'exit' | 'enter'

function MissionSwapFx() {
  return (
    <div className="kiosk-missionSwapFx" aria-hidden>
      <div className="kiosk-missionSwapFlash" />
      <div className="kiosk-missionSwapRing" />
      <div className="kiosk-missionSwapRing kiosk-missionSwapRing--2" />
      {MISSION_SWAP_SPARKS.map((spark, i) => (
        <span
          key={i}
          className="kiosk-missionSwapSpark"
          style={{
            width: spark.size,
            height: spark.size,
            background: spark.color,
            boxShadow: `0 0 10px ${spark.color}`,
            animationDelay: spark.delay,
            ['--msx' as string]: spark.msx,
            ['--msy' as string]: spark.msy,
          }}
        />
      ))}
    </div>
  )
}


function RecommendedMissionSwap({
  action, now, reducedMotion,
}: {
  action: KioskAction | null
  now: Date
  reducedMotion: boolean
}) {
  const [displayed, setDisplayed] = useState(action)
  const [exiting, setExiting] = useState<KioskAction | null>(null)
  const [phase, setPhase] = useState<MissionSwapPhase>('idle')
  const pendingRef = useRef(action)
  const skipAnimRef = useRef(true)

  useEffect(() => {
    pendingRef.current = action
    if (action?.id === displayed?.id) {
      setDisplayed(action)
      return
    }
    if (reducedMotion || skipAnimRef.current) {
      skipAnimRef.current = false
      setDisplayed(action)
      setExiting(null)
      setPhase('idle')
      return
    }
    if (phase === 'enter') {
      setExiting(displayed)
      setPhase('exit')
      return
    }
    if (phase === 'exit') return
    setExiting(displayed)
    setPhase('exit')
  }, [action, action?.id, displayed, displayed?.id, reducedMotion, phase])

  useEffect(() => {
    if (phase === 'exit') {
      const t = setTimeout(() => {
        setExiting(null)
        setDisplayed(pendingRef.current)
        setPhase('enter')
      }, MISSION_SWAP_EXIT_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'enter') {
      const t = setTimeout(() => setPhase('idle'), MISSION_SWAP_ENTER_MS)
      return () => clearTimeout(t)
    }
  }, [phase])

  const pointsPhase: 'idle' | 'out' | 'in' = phase === 'enter' ? 'in' : phase !== 'idle' ? 'out' : 'idle'
  const showCard = phase === 'idle' || phase === 'enter'

  return (
    <div className="kiosk-missionSwapStage">
      {phase === 'exit' && exiting && (
        <div key={`exit-${exiting.id}`} className="kiosk-missionSwapLayer kiosk-missionSwapLayer--exit">
          <RecommendedMissionCard action={exiting} now={now} reducedMotion={reducedMotion} swapRole="out" />
        </div>
      )}
      {showCard && (
        <div
          key={displayed?.id ?? 'none'}
          className={phase === 'enter' ? 'kiosk-missionSwapLayer kiosk-missionSwapLayer--enter' : 'kiosk-missionSwapLayer'}
        >
          {phase === 'enter' && !reducedMotion && <MissionSwapFx />}
          <RecommendedMissionCard
            action={displayed}
            now={now}
            reducedMotion={reducedMotion}
            entering={phase === 'enter' && !reducedMotion}
            swapRole={phase === 'enter' ? 'in' : undefined}
          />
          <FloatingPointsBadge action={displayed} reducedMotion={reducedMotion} swapPhase={pointsPhase} />
        </div>
      )}
    </div>
  )
}


function RecommendedMissionCard({
  action, now, reducedMotion = false, entering = false, swapRole,
}: {
  action: KioskAction | null
  now: Date
  reducedMotion?: boolean
  entering?: boolean
  swapRole?: 'in' | 'out'
}) {
  const inDailyWindow = action ? isInDailyTimeWindow(action, now) : false
  const dailyWindow = action ? getDailyTimeWindow(action) : { start: null, end: null }
  const hasTimeWindow = Boolean(action?.daily_limit && hasDailyTimeWindow(dailyWindow))
  const remainingMinutes = action && hasTimeWindow && inDailyWindow
    ? getDailyWindowRemainingMinutes(action, now)
    : null
  const showCountdown = remainingMinutes !== null
  const hasGroups = Boolean(action && action.groups.length > 0)
  const timer = remainingMinutes !== null ? formatRemainingAsTimer(remainingMinutes) : null
  const isUrgent = remainingMinutes !== null && remainingMinutes <= 15

  const blinkClass = !reducedMotion && showCountdown
    ? (isUrgent ? 'kiosk-timerTitleUrgent' : 'kiosk-timerTitleFlash')
    : undefined
  const blinkKey = `${action?.id ?? 'none'}-${isUrgent ? 'u' : 'a'}`
  const accentHot = showCountdown && isUrgent
  const badgeLabel = showCountdown ? 'משימה פעילה' : 'משימה מומלצת'

  return (
    <div
      className={[
        'kiosk-missionCard',
        swapRole === 'out' ? 'kiosk-missionCard--swapOut' : '',
        swapRole === 'in' ? 'kiosk-missionCard--swapIn' : '',
      ].filter(Boolean).join(' ')}
      style={{
      position: 'relative', zIndex: 1, borderRadius: 22,
      boxSizing: 'border-box', width: '100%',
      padding: showCountdown ? '46px 20px 20px' : '54px 20px 28px',
      background: '#FFFFFF', boxShadow: '0 10px 24px rgba(120,50,10,0.18)',
      overflow: 'visible', color: '#2E221E',
      border: showCountdown ? '2px solid rgba(255,120,50,0.55)' : '1.5px solid #FFD8BC',
    }}>
      {action && swapRole !== 'out' && (
        <div className="kiosk-missionTypeBadgeAnchor" aria-hidden>
          <div
            key={`${action.id}-${showCountdown ? 'active' : 'rec'}`}
            className={[
              'kiosk-missionTypeBadge',
              showCountdown ? 'kiosk-missionTypeBadge--active' : 'kiosk-missionTypeBadge--recommended',
              entering && !reducedMotion ? 'kiosk-missionTypeBadge--enter' : '',
              accentHot ? 'kiosk-missionTypeBadge--urgent' : '',
            ].filter(Boolean).join(' ')}
          >
            {badgeLabel}
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', top: -30, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,147,102,0.1)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 22, pointerEvents: 'none' }}>
        <div className="kiosk-shimmerSweep" style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)' }} />
      </div>

      {action && (
        <div
          className="kiosk-floatY-2"
          style={{
            position: 'absolute', top: -24, right: -22, zIndex: 30,
            width: 74, height: 74,
          }}
        >
          <div
            className="kiosk-pulseGlow"
            style={{
              position: 'absolute', inset: -6, borderRadius: '50%',
              background: accentHot
                ? 'radial-gradient(circle, rgba(255,80,40,0.45) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(255,147,102,0.4) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            className={entering ? 'kiosk-missionSwapIconPop' : 'kiosk-fireFlicker'}
            style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', height: '100%',
              background: 'linear-gradient(145deg,#FFFFFF,#FFF4EC)',
              borderRadius: '50%',
              fontSize: 54, lineHeight: 1,
              border: `3px solid ${accentHot ? 'rgba(220,50,20,0.85)' : 'rgba(255,100,40,0.75)'}`,
              boxShadow: accentHot
                ? '0 10px 28px rgba(220,40,20,0.38), 0 0 0 5px rgba(255,255,255,0.9), 0 0 24px rgba(255,80,40,0.35)'
                : '0 10px 26px rgba(120,50,10,0.28), 0 0 0 5px rgba(255,255,255,0.9), 0 0 20px rgba(255,147,102,0.3)',
            }}
          >
            🎯
          </div>
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        {hasGroups && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {action!.groups.map((group) => (
              <div
                key={group.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  borderRadius: 999, padding: '2px 6px 2px 5px',
                  border: `1px solid color-mix(in srgb, ${group.color} 45%, white)`,
                  background: `color-mix(in srgb, ${group.color} 10%, white)`,
                }}
              >
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: group.color,
                }} />
                <span style={{ fontSize: 9, fontWeight: 800, color: '#2E221E', lineHeight: 1.2 }}>
                  {group.name}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: hasGroups ? 14 : 0, maxWidth: '100%' }}>
          <div
            className={
              reducedMotion
                ? undefined
                : entering
                  ? 'kiosk-missionSwapTitleIn'
                  : 'kiosk-missionNameFlash'
            }
            style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15 }}
          >
            {action?.name ?? '---'}
          </div>
        </div>

        {showCountdown && timer && (
          <div style={{ marginTop: 10, width: '100%' }}>
            <div style={{
              fontSize: 10, fontWeight: 900, letterSpacing: 1.5,
              color: isUrgent ? '#B82018' : '#B5623C', marginBottom: 4,
            }}>
              {isUrgent ? '⚡ זמן אוזל!' : 'זמן נותר לביצוע'}
            </div>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                direction: 'ltr',
                fontSize: 'clamp(34px, 4.2vw, 44px)', fontWeight: 900, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: isUrgent ? '#D82010' : '#D45A1A',
                letterSpacing: '0.04em',
              }}
            >
              <span>{timer.hours}</span>
              <span key={`colon-${blinkKey}`} className={blinkClass} style={{ marginBottom: 4 }}>:</span>
              <span>{timer.minutes}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


// ─── Main kiosk display ───────────────────────────────────────────────────────

function KioskDisplay({ event, data, gameStarted }: { event: Event; data: KioskData; gameStarted: boolean }) {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()

  const {
    recentActivity, rewards, topPrizes, configuredRewardsCount, newestRewardId,
    stats, totalScans, actions, kioskParticipants, actionCompletionIndex, refetch,
  } = data
  const hasActivity = recentActivity.length > 0
  const hasAwardedRewards = rewards.length > 0
  const hasConfiguredRewards = configuredRewardsCount > 0

  // Recommended mission — prioritises time-window tasks while they are active
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [])

  const displayableActions = useMemo(() => {
    const withConstraints = actions.map((action) => ({
      ...action,
      is_active: true,
      allowedGroupIds: action.groups.map((group) => group.id),
    }))
    return filterActionsWithAvailableParticipants(
      withConstraints,
      kioskParticipants,
      actionCompletionIndex,
      now,
    )
  }, [actions, kioskParticipants, actionCompletionIndex, now])

  const rotatableActions = useMemo(() => {
    const activeWindowActions = displayableActions.filter(
      (a) => a.daily_limit && hasDailyTimeWindow(getDailyTimeWindow(a)) && isInDailyTimeWindow(a, now),
    )
    return activeWindowActions.length > 0 ? activeWindowActions : displayableActions
  }, [displayableActions, now])

  const [recommendedIdx, setRecommendedIdx] = useState(0)
  useEffect(() => {
    setRecommendedIdx(0)
  }, [rotatableActions.length])

  useEffect(() => {
    if (!gameStarted || rotatableActions.length <= 1) return
    const t = setInterval(() => setRecommendedIdx(i => (i + 1) % rotatableActions.length), MISSION_ROTATE_MS)
    return () => clearInterval(t)
  }, [rotatableActions.length, gameStarted])
  const recommendedAction = rotatableActions[recommendedIdx] ?? null

  // Scanner state
  const { submit, submitting } = useScoreSubmit(event.id)
  const catalog = useEventCatalog(event.id)
  const [scanResult, setScanResult] = useState<ScanResultDisplay | null>(null)
  const [rewardWin, setRewardWin] = useState<RewardWinDisplay | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const scanDismissTimer = useRef<ReturnType<typeof setTimeout>>()
  const rewardDismissTimer = useRef<ReturnType<typeof setTimeout>>()
  const rewardQueueRef = useRef<RewardWinDisplay[]>([])

  // Clean up timers on unmount
  useEffect(() => () => {
    clearTimeout(toastTimerRef.current)
    clearTimeout(scanDismissTimer.current)
    clearTimeout(rewardDismissTimer.current)
  }, [])

  useEffect(() => {
    if (gameStarted) return
    clearTimeout(scanDismissTimer.current)
    clearTimeout(rewardDismissTimer.current)
    rewardQueueRef.current = []
    setScanResult(null)
    setRewardWin(null)
    setShowManual(false)
  }, [gameStarted])

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimerRef.current)
    setToastMsg(msg)
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 4000)
  }, [])

  // Pops the next queued celebration or clears the overlay
  const showNextReward = useCallback(() => {
    clearTimeout(rewardDismissTimer.current)
    const next = rewardQueueRef.current.shift()
    if (!next) { setRewardWin(null); return }
    setRewardWin(next)
    rewardDismissTimer.current = setTimeout(() => showNextReward(), 6200)
  }, [])

  const triggerScanSuccess = useCallback((result: ScoreSubmitResult, _txId: string, rm: boolean) => {
    clearTimeout(scanDismissTimer.current)
    clearTimeout(rewardDismissTimer.current)
    refetch()
    setScanResult({
      name: result.participantName,
      action: `השלים/ה · ${result.actionName}`,
      initial: result.participantName.charAt(0),
      emoji: '🎯',
      points: result.points,
      totalPoints: result.participantTotalPoints,
      tone: '#EF8A4E',
    })
    const { celebrationRewards } = result
    scanDismissTimer.current = setTimeout(() => {
      setScanResult(null)
      if (celebrationRewards.length > 0) {
        if (!rm) playSuccessChime()
        const wins = celebrationRewards.map(rw => {
          const { icon } = rewardTier(rw.out_required_points)
          return { emoji: icon, title: rw.out_reward_name, sub: result.participantName, points: rw.out_required_points }
        })
        rewardQueueRef.current.push(...wins)
        showNextReward()
      }
    }, SCAN_SUCCESS_MS)
  }, [showNextReward, refetch])

  const logScoreSubmit = useCallback((source: 'qr_scan' | 'manual_entry', result: ScoreSubmitResult) => {
    console.log('[kiosk score submit]', {
      source,
      participantId: result.participantId,
      participantCode: result.participantExternalId,
      participantName: result.participantName,
      actionId: result.actionId,
      actionCode: result.actionCode,
      actionName: result.actionName,
      addedPoints: result.points,
      participantTotalPoints: result.participantTotalPoints,
    })
  }, [])

  const handleScan = useCallback(async (raw: string) => {
    if (!gameStarted) {
      showToast('התחרות עדיין לא התחילה')
      return
    }
    const parsed = parseQrPayload(raw)
    if (!parsed.ok) { showToast('קוד QR לא תקין'); return }
    const response = await submit(parsed.data.participantCode, parsed.data.actionCode)
    if (!response.ok) {
      showToast(response.error)
      return
    }
    logScoreSubmit('qr_scan', response.result)
    triggerScanSuccess(response.result, response.result.transactionId, reducedMotion)
  }, [gameStarted, submit, showToast, logScoreSubmit, triggerScanSuccess, reducedMotion])

  const bind = useHardwareScanner(gameStarted && !showManual && !submitting, handleScan)

  const handleManualSubmit = useCallback(async (participantCode: string, actionCode: string) => {
    if (!gameStarted) {
      showToast('התחרות עדיין לא התחילה')
      return
    }
    const response = await submit(participantCode, actionCode)
    if (!response.ok) {
      showToast(response.error)
      return
    }
    logScoreSubmit('manual_entry', response.result)
    setShowManual(false)
    triggerScanSuccess(response.result, response.result.transactionId, reducedMotion)
  }, [gameStarted, submit, showToast, logScoreSubmit, triggerScanSuccess, reducedMotion])

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden', position: 'relative',
      direction: 'rtl', color: '#2E221E',
      backgroundColor: '#FFF8F3',
      backgroundImage: [
        'radial-gradient(ellipse 60% 50% at 88% -10%,rgba(255,138,77,0.14),transparent 55%)',
        'radial-gradient(ellipse 55% 45% at 8% -6%,rgba(242,179,60,0.14),transparent 58%)',
        'radial-gradient(ellipse 55% 50% at 50% 122%,rgba(255,147,102,0.10),transparent 60%)',
      ].join(','),
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Hidden scanner input — captures hardware scanner keystrokes */}
      <input ref={bind} className="sr-only" aria-hidden="true" tabIndex={-1} />

      {/* Animated gradient backdrop */}
      <div className="kiosk-gradientShift" style={{
        position: 'absolute', inset: '-25%', zIndex: 0, pointerEvents: 'none', opacity: 0.75,
        background: 'linear-gradient(120deg,#FFE7D3,#FFF3DD,#E4F4F0,#FFEAD6,#FCEEDD,#FFE7D3)',
        backgroundSize: '320% 320%',
      }} />

      {/* Festive top strip */}
      <div style={{ position: 'relative', zIndex: 1, height: 6, flex: '0 0 auto', background: 'linear-gradient(90deg,#FF9366,#FFB84D,#FFD68A,#8FCFA0,#5FB3AA)' }} />

      {/* Header */}
      <div style={{
        position: 'relative', zIndex: 1, height: 74, flex: '0 0 auto',
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 clamp(16px, 2vw, 40px)',
        borderBottom: '1px solid #F0DBD0', background: 'rgba(255,255,255,0.55)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {event.logo_url ? (
            <img
              src={event.logo_url}
              alt=""
              style={{ width: 46, height: 46, borderRadius: 14, objectFit: 'cover', boxShadow: '0 6px 16px rgba(255,147,102,0.3)' }}
            />
          ) : (
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              background: 'linear-gradient(135deg,#FF9366,#F2B33C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              boxShadow: '0 6px 16px rgba(255,147,102,0.3)',
            }}>🏝️</div>
          )}
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{event.name}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7D706A' }}>עמדת סריקה</div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginRight: 20,
          background: gameStarted ? 'rgba(98,181,132,0.14)' : 'rgba(242,179,60,0.16)', border: gameStarted ? '1px solid rgba(98,181,132,0.4)' : '1px solid rgba(242,179,60,0.46)',
          color: gameStarted ? '#3F8A5E' : '#A36F00', padding: '8px 16px', borderRadius: 999, fontWeight: 800, fontSize: 0,
        }}>
          <span className="kiosk-blink" style={{ width: 10, height: 10, borderRadius: '50%', background: gameStarted ? '#62B584' : '#F2B33C', display: 'inline-block' }} />
          <span style={{ fontSize: 14 }}>{gameStarted ? 'המשחק פעיל' : 'לפני התחלה'}</span>
          המשחק פעיל
        </div>
        <div style={{ flex: 1 }} />
        <div style={{
          width: 42, height: 42, borderRadius: 12, background: '#FFF', border: '1px solid #F0DBD0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#7D706A',
        }}>🔊</div>
        <button
          onClick={() => navigate(`/events/${event.id}/control`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            borderRadius: 12, color: '#7D706A', fontWeight: 800, fontSize: 15,
            background: 'none', border: 'none', cursor: 'pointer',
          }}>
          חזרה <span style={{ fontSize: 17 }}>←</span>
        </button>
      </div>

      {/* Body */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', minHeight: 0, padding: 'clamp(12px, 1.2vw, 24px)', gap: 'clamp(10px, 1.0vw, 20px)' }}>

        {/* RIGHT PANEL — orange */}
        <div className="kiosk-fadeUp" style={{
          flex: '0 0 clamp(300px, 26vw, 560px)', display: 'flex', flexDirection: 'column', gap: 14,
          minHeight: 0, borderRadius: 24, padding: 18,
          background: 'linear-gradient(165deg,#FF9E6B,#EF8A4E)',
          boxShadow: '0 14px 32px rgba(239,138,78,0.3)',
          position: 'relative', overflow: 'visible',
        }}>
          <GlowingStarsOrange />

          {!gameStarted && <MissionPreGamePanel />}

          {/* Recommended mission hero card */}
          <div style={{ display: gameStarted ? 'block' : 'none', marginBottom: 36, position: 'relative', zIndex: 20, overflow: 'visible' }}>
            <RecommendedMissionSwap action={recommendedAction} now={now} reducedMotion={reducedMotion} />
          </div>

          {/* Stat tiles */}
          <div style={{ display: gameStarted && hasActivity ? 'flex' : 'none', gap: 10, position: 'relative', zIndex: 1 }}>
            {[
              { value: stats.totalMissions, label: 'משימות', color: '#E07A3E' },
              { value: stats.totalPoints, label: 'נקודות', color: '#4C9E6E' },
              { value: stats.totalGroups, label: 'קבוצות', color: '#3E8F88' },
            ].map((s, i) => (
              <div key={s.label} className="kiosk-fadeUp kiosk-liftHover" style={{
                flex: 1, background: '#FFFFFF', borderRadius: 16, padding: '12px 6px',
                textAlign: 'center', boxShadow: '0 4px 12px rgba(120,50,10,0.12)',
                animationDelay: `${0.1 + i * 0.1}s`,
              }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value.toLocaleString('he-IL')}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#B5623C', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recent activity feed */}
          <div style={{ display: gameStarted ? 'block' : 'none', flex: 1, minHeight: 0, position: 'relative', zIndex: 1, overflow: 'hidden' }}>
            <ActivityView rows={recentActivity} active={true} reducedMotion={reducedMotion} />
          </div>
        </div>

        {/* CENTER — Scanner */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, position: 'relative' }}>
          {/* Confetti dots */}
          <div className="kiosk-floatY-1" style={{ position: 'absolute', top: 40, right: 80, width: 16, height: 16, borderRadius: 5, background: '#F2B33C' }} />
          <div className="kiosk-floatY-2" style={{ position: 'absolute', top: 100, left: 70, width: 14, height: 14, borderRadius: '50%', background: '#5FB3AA' }} />
          <div className="kiosk-floatY-3" style={{ position: 'absolute', top: 180, right: 40, width: 13, height: 13, borderRadius: '50%', background: '#FF9366' }} />
          <div className="kiosk-floatY-1" style={{ position: 'absolute', bottom: 150, right: 110, width: 12, height: 12, borderRadius: '50%', background: '#FFB84D' }} />
          <div className="kiosk-floatY-4" style={{ position: 'absolute', bottom: 90, left: 100, width: 18, height: 18, borderRadius: 6, background: '#8FCFA0' }} />
          <div className="kiosk-floatY-2" style={{ position: 'absolute', bottom: 200, left: 50, width: 12, height: 12, borderRadius: 5, background: '#FFCB9A' }} />

          {!gameStarted && (
            <div style={{ textAlign: 'center', maxWidth: 620 }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: '#FF8A3D' }}>מוכנים לשחק?</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#7D706A', marginTop: 8, lineHeight: 1.45 }}>
                הלוח, המשימות והפרסים יופיעו ברגע שהתחרות תתחיל.
              </div>
              <div className="kiosk-arrowBounce" style={{ marginTop: 18, fontSize: 24, fontWeight: 900, color: '#3E8F88' }}>
                👇 סרקו כאן כדי להתחיל
              </div>
            </div>
          )}

          {gameStarted && !hasActivity && (
            <div style={{ textAlign: 'center', maxWidth: 620 }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#FF8A3D' }}>🎉 הכול מוכן לרגע הגדול</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#7D706A', marginTop: 8, lineHeight: 1.45 }}>
                סרקו את המשתתף הראשון ותנו לתחרות להתחיל!
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#3E8F88', marginTop: 8, lineHeight: 1.45 }}>
                הסריקה הראשונה היא רק ההתחלה...
              </div>
            </div>
          )}

          <div style={{ display: gameStarted && hasActivity ? 'block' : 'none', textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontWeight: 900 }}>
              <span style={{ color: '#FF8A3D' }}>סרקו</span>{' '}
              <span style={{ color: '#F2A03C' }}>וזכו</span>{' '}
              <span style={{ color: '#E8A93C' }}>בנקודות!</span>{' '}
              🎯
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#7D706A', marginTop: 6 }}>
              כל משימה שתשלימו מקרבת את הקבוצה שלכם להובלה
            </div>
          </div>

          <ScannerFrame processing={gameStarted && submitting} />

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#2E221E' }}>כוונו את כרטיס ה-QR של המשתתף למסגרת</div>
            <button
              onClick={() => setShowManual(true)}
              style={{
                display: gameStarted ? 'inline' : 'none',
                fontSize: 15, fontWeight: 800, color: '#3E8F88', marginTop: 8,
                textDecoration: 'underline', textUnderlineOffset: 3,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
              או בחרו הזנה ידנית — שחקן · משימה
            </button>
            {!gameStarted && (
              <div style={{ fontSize: 15, fontWeight: 900, color: '#7D706A', marginTop: 8 }}>
                התחרות מתחילה ברגע שהמשתתף הראשון סורק 🚀
              </div>
            )}
          </div>

          {/* Scan-success overlay — covers center column */}
          <ScanSuccessOverlay
            result={scanResult}
            onDismiss={() => {
              clearTimeout(scanDismissTimer.current)
              setScanResult(null)
              refetch()
            }}
            reducedMotion={reducedMotion}
          />
        </div>

        {/* LEFT PANEL — teal / rewards */}
        <div className="kiosk-fadeUp" style={{
          flex: '0 0 clamp(300px, 27vw, 580px)', position: 'relative', overflow: 'hidden',
          borderRadius: 24, background: 'linear-gradient(165deg,#7CCBC3,#4FA6A0)',
          boxShadow: '0 14px 32px rgba(59,136,128,0.28)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.16) 1.5px,transparent 1.6px)', backgroundSize: '22px 22px', opacity: 0.55, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -70, right: -50, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.28),transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -90, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,214,138,0.22),transparent 70%)', pointerEvents: 'none' }} />
          <GlowingStarsTeal />

          {/* Rewards section */}
          <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>🎁</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF', textShadow: '0 1px 6px rgba(0,0,0,0.18)' }}>פרסים שחולקו</span>
              </div>
              {gameStarted && <LivePill />}
            </div>

            {/* Top prizes */}
            {hasConfiguredRewards && <TopPrizes prizes={topPrizes} />}

            {/* Awarded rewards feed */}
            {!hasConfiguredRewards ? (
              <RewardsNotConfiguredState onCreate={() => navigate(`/events/${event.id}/step/5`)} />
            ) : hasAwardedRewards ? (
              <AwardedRewardsFeed rewards={rewards} newestId={newestRewardId} />
            ) : gameStarted && hasActivity ? (
              <RewardsActiveNoAwardsFeed />
            ) : gameStarted ? (
              <RewardsStartedEmptyFeed />
            ) : (
              <RewardsPreGameFeed />
            )}

            {/* Footer */}
            <div style={{ display: gameStarted && hasActivity ? 'block' : 'none', textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
              🎉 {stats.totalPoints.toLocaleString('he-IL')} נקודות חולקו · {totalScans} סריקות
            </div>
          </div>
        </div>
      </div>

      {/* Reward celebration — full-screen takeover, z-index 40 */}
      <RewardCelebration
        win={rewardWin}
        onDismiss={showNextReward}
        reducedMotion={reducedMotion}
      />

      {/* Manual entry modal */}
      {showManual && (
        <div
          role="dialog"
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(46,34,30,0.65)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowManual(false) }}
        >
          <div style={{ position: 'relative', width: 440 }}>
            <button
              onClick={() => setShowManual(false)}
              style={{
                position: 'absolute', top: -14, left: 16, zIndex: 1,
                width: 32, height: 32, borderRadius: '50%',
                background: '#2E221E', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              ×
            </button>
            <ManualEntryForm
              eventId={event.id}
              accent={KIOSK_ACCENT}
              submitting={submitting}
              onSubmit={handleManualSubmit}
              catalog={catalog}
            />
          </div>
        </div>
      )}

      {/* Error toast */}
      {toastMsg && (
        <div style={{
          position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, background: '#2E221E', color: '#fff',
          padding: '12px 24px', borderRadius: 14,
          fontWeight: 800, fontSize: 15,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          ⚠️ {toastMsg}
        </div>
      )}
    </div>
  )
}

// ─── Viewport wrapper ─────────────────────────────────────────────────────────
function KioskViewport({ event, data, gameStarted }: { event: Event; data: KioskData; gameStarted: boolean }) {
  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', background: '#FFF8F3' }}>
      <KioskDisplay event={event} data={data} gameStarted={gameStarted} />
    </div>
  )
}

// ─── Page entry point ─────────────────────────────────────────────────────────
export function EventKioskPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return
      const { data } = await supabase
        .from('events').select('*').eq('id', id).neq('status', 'archived').single()
      if (!data) { navigate('/events', { replace: true }); return }
      setEvent(data)
      setLoading(false)
    }
    fetchEvent()
  }, [id, navigate])

  const gameStarted = event ? isGameStarted(event) : false
  const data = useKioskData(id ?? '', gameStarted)

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`kiosk_event_${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` },
        (payload) => setEvent(payload.new as Event)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  if (loading || !event) return <FullPageLoader />

  if (data.error && !data.loading) {
    return (
      <div style={{ width: '100vw', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF8F3', direction: 'rtl' }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: 48, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', maxWidth: 400 }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginTop: 16, color: '#2E221E', margin: '16px 0 8px' }}>שגיאה בטעינת נתונים</h2>
          <p style={{ fontSize: 15, color: '#7D706A', margin: 0 }}>לא ניתן לטעון את נתוני האירוע. אנא בדקו את החיבור לאינטרנט.</p>
          <button
            onClick={data.refetch}
            style={{ marginTop: 24, padding: '12px 28px', borderRadius: 14, background: '#AB3500', color: '#fff', fontWeight: 900, border: 'none', cursor: 'pointer', fontSize: 16 }}>
            נסה שוב
          </button>
        </div>
      </div>
    )
  }

  return <KioskViewport event={event} data={data} gameStarted={gameStarted} />
}
