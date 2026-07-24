import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { ScreenControls } from '@/components/ui/ScreenControls'
import { ShimmerText } from '@/components/ui/ShimmerText'
import { computeRanks } from '@/lib/missionUtils'
import { ManualEntryForm, type ManualEntryAvailability } from '@/components/scoring/ManualEntryForm'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import { usePlanPermissions } from '@/hooks/usePlanPermissions'
import { useScoreSubmit } from '@/hooks/useScoreSubmit'
import { useEventCatalog } from '@/hooks/useEventCatalog'
import { useScanSequence } from '@/hooks/useScanSequence'
import { hexToRgb } from '@/lib/accentColor'
import { getIsraelSecond } from '@/lib/israelTime'
import {
  buildActionCompletionIndex,
  filterActionsWithAvailableParticipants,
  type ActionCompletionIndex,
  type KioskAvailabilityParticipant,
} from '@/lib/canPerformAction'
import {
  formatRemainingAsTimer,
  getDailyTimeWindow,
  getDailyWindowRemainingSeconds,
  hasDailyTimeWindow,
  isInDailyTimeWindow,
} from '@/lib/taskLimit'
import {
  getRewardScopeLabel,
  isParticipantEligibleForReward,
  isRewardStillClaimable,
  type RewardTargetingFields,
} from '@/lib/rewardTargeting'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import type { Event, GroupLeaderboardEntry, ParticipantLeaderboardEntry } from '@/types'
import type { ScoreSubmitResult } from '@/hooks/useScoreSubmit'
import {
  trackScannerView,
  trackScanSuccess,
  trackScanFailed,
  trackPrizeRevealed,
  trackTrialScanCompleted,
  trackTrialScanLimitReached,
  trackAppError,
} from '@/lib/analytics'
import { TrialScanLimitModal } from '@/components/TrialScanLimitModal'
import { TRIAL_SCAN_LIMIT } from '@/lib/plans'
import { playScanSuccess } from '@/lib/scanSuccessSound'
import { playRewardFanfare, primeRewardFanfare, stopRewardFanfare } from '@/lib/rewardFanfareSound'
import '@/styles/kiosk.css'

const KIOSK_ACCENT = hexToRgb('#AB3500') ?? { r: 171, g: 53, b: 0 }
const KIOSK_CENTER_GAP = 32
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
// Deterministic LCG seeded to 41 - same result every render.
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
type RewardRow = { id: string; icon: string; title: string; recipient: string; score: number; accent: string; createdAt: string }
type TopPrizeRow = {
  id: string
  name: string
  icon: string
  requiredPoints: number
  accent: string
  targetType: RewardTargetingFields['target_type']
  winnerMode: RewardTargetingFields['winner_mode']
  groupIds: string[]
  groupName?: string
}
type PrizeChaseParticipant = { id: string; name: string; groupIds: string[]; totalPoints: number }
type PrizeChaseRow = {
  participantId: string
  name: string
  initial: string
  totalPoints: number
  gap: number
  progressPct: number
}
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
  allClaimablePrizes: TopPrizeRow[]
  prizeChaseParticipants: PrizeChaseParticipant[]
  prizeAwardedPairs: { participant_id: string; reward_id: string }[]
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
  /** Freeze the prize panels so a win never lands in the banner before its celebration. */
  holdPrizeReveal: (hold: boolean) => void
}

/** Everything the teal panel renders about prizes - applied together, or held together. */
type PrizePanelSnapshot = {
  awardedPairs: { participant_id: string; reward_id: string }[]
  chaseParticipants: PrizeChaseParticipant[] | null
  rewards: RewardRow[] | null
  allClaimable: TopPrizeRow[] | null
}

function isGameStarted(event: Event): boolean {
  return event.status === 'active'
}

function rewardTier(pts: number): { icon: string; accent: string } {
  if (pts >= 1000) return { icon: '🏅', accent: '#F2B33C' }
  if (pts >= 500) return { icon: '🎖️', accent: '#4FA6A0' }
  return { icon: '🏆', accent: '#FF8A4D' }
}

type ClaimableRewardDef = RewardTargetingFields & {
  id: string
  name: string
  required_points: number
}

function toTopPrizeRow(
  reward: ClaimableRewardDef,
  options?: { groupName?: string },
): TopPrizeRow {
  const pts = reward.required_points
  const { icon, accent } = rewardTier(pts)
  return {
    id: reward.id,
    name: reward.name,
    icon,
    requiredPoints: pts,
    accent,
    targetType: reward.target_type,
    winnerMode: reward.winner_mode,
    groupIds: reward.groupIds,
    groupName: options?.groupName,
  }
}

/** Next active rewards someone can still earn - skips tiers fully claimed. */
function pickNextClaimableTopPrizes(
  rewards: ClaimableRewardDef[],
  participants: { id: string; groupIds: string[] }[],
  awardedPairs: { participant_id: string; reward_id: string }[],
  groupNames: Map<string, string>,
  limit = 3,
): TopPrizeRow[] {
  const sorted = [...rewards].sort((a, b) => a.required_points - b.required_points)
  const result: TopPrizeRow[] = []

  for (const reward of sorted) {
    if (!isRewardStillClaimable(reward, participants, awardedPairs)) continue

    const groupName = reward.groupIds.length === 1
      ? groupNames.get(reward.groupIds[0])
      : undefined

    result.push(toTopPrizeRow(reward, { groupName }))
    if (result.length >= limit) break
  }

  return result
}

/** Each participant is assigned to exactly one prize - the lowest tier they still pursue. */
function buildParticipantChaseAssignments(
  prizes: TopPrizeRow[],
  participants: PrizeChaseParticipant[],
  awardedPairs: { participant_id: string; reward_id: string }[],
): Map<string, string> {
  const awarded = new Set(awardedPairs.map((p) => `${p.participant_id}:${p.reward_id}`))
  const sorted = [...prizes].sort((a, b) => a.requiredPoints - b.requiredPoints)
  const assignments = new Map<string, string>()

  for (const participant of participants) {
    for (const prize of sorted) {
      const rewardFields: RewardTargetingFields = {
        target_type: prize.targetType,
        target_participant_id: null,
        winner_mode: prize.winnerMode,
        groupIds: prize.groupIds,
      }
      if (!isParticipantEligibleForReward(participant, rewardFields)) continue
      if (awarded.has(`${participant.id}:${prize.id}`)) continue
      assignments.set(participant.id, prize.id)
      break
    }
  }

  return assignments
}

function getChaseParticipantsForPrize(
  prize: TopPrizeRow,
  participants: PrizeChaseParticipant[],
  chaseAssignments: Map<string, string>,
): PrizeChaseRow[] {
  const seen = new Set<string>()
  return participants
    .filter((p) => chaseAssignments.get(p.id) === prize.id)
    .map((p) => {
      const gap = Math.max(0, prize.requiredPoints - p.totalPoints)
      const progressPct = prize.requiredPoints > 0
        ? Math.min(100, Math.round((p.totalPoints / prize.requiredPoints) * 100))
        : 0
      return {
        participantId: p.id,
        name: p.name,
        initial: p.name.charAt(0) || '?',
        totalPoints: p.totalPoints,
        gap,
        progressPct,
      }
    })
    .sort((a, b) => {
      if (a.gap !== b.gap) return a.gap - b.gap
      return b.totalPoints - a.totalPoints
    })
    .filter((row) => {
      if (seen.has(row.participantId)) return false
      seen.add(row.participantId)
      return true
    })
}

const PRIZE_CHASE_ROTATE_MS = 4_200
const PRIZE_CHASE_MAX_VISIBLE = 3
const PRIZE_CHASE_MAX_CANDIDATES = 20
const PRIZE_CHASE_ROW_GAP = 4
const PRIZE_CHASE_ROW_STEP = 62
const PRIZE_CHASE_NUDGES_LEAD = ['כמעט שם!', 'עוד נקודה!', 'הפרס ממש קרוב!'] as const
const PRIZE_CHASE_NUDGES_MID = ['לא עוצרים!', 'עוד דחיפה!', 'בדרך לפרס!'] as const
const PRIZE_CHASE_NUDGES_CHASE = ['במרוץ לפרס!', 'כל נקודה קרבה!', 'זה אפשרי!'] as const

/** Teal + warm yellow - lighter = farther, deeper + more gold = closer. */
const PRIZE_CHASE_ACCENTS = {
  chase: '#8FCEC8',
  mid: '#58B5AD',
  lead: '#48A89E',
  ready: '#388882',
} as const
const PRIZE_CHASE_TINTS = {
  chase: '14%',
  mid: '22%',
  lead: '30%',
  ready: '38%',
} as const
const PRIZE_CHASE_WARM = {
  chase: '12%',
  mid: '20%',
  lead: '32%',
  ready: '46%',
} as const
const PRIZE_CHASE_NUDGE_ICONS = {
  ready: ['🏆'] as const,
  lead: ['🔥', '⚡', '🎯'] as const,
  mid: ['💪', '🚀', '⭐'] as const,
  chase: ['🏃', '📈', '✨'] as const,
} as const

type PrizeChaseTone = keyof typeof PRIZE_CHASE_ACCENTS

function getPrizeChaseNudge(row: PrizeChaseRow, chaserIndex: number): {
  text: string
  hot: boolean
  tone: PrizeChaseTone
  icon: string
} {
  if (row.gap === 0) {
    return { text: 'מוכן לזכייה!', hot: true, tone: 'ready', icon: PRIZE_CHASE_NUDGE_ICONS.ready[0] }
  }
  if (chaserIndex === 0 || row.progressPct >= 82) {
    const i = chaserIndex % PRIZE_CHASE_NUDGES_LEAD.length
    return {
      text: PRIZE_CHASE_NUDGES_LEAD[i],
      hot: true,
      tone: 'lead',
      icon: PRIZE_CHASE_NUDGE_ICONS.lead[i],
    }
  }
  if (row.progressPct >= 50) {
    const i = chaserIndex % PRIZE_CHASE_NUDGES_MID.length
    return {
      text: PRIZE_CHASE_NUDGES_MID[i],
      hot: false,
      tone: 'mid',
      icon: PRIZE_CHASE_NUDGE_ICONS.mid[i],
    }
  }
  const i = chaserIndex % PRIZE_CHASE_NUDGES_CHASE.length
  return {
    text: PRIZE_CHASE_NUDGES_CHASE[i],
    hot: false,
    tone: 'chase',
    icon: PRIZE_CHASE_NUDGE_ICONS.chase[i],
  }
}

function prizeChaseAccentForTone(tone: PrizeChaseTone): string {
  return PRIZE_CHASE_ACCENTS[tone]
}

function prizeChaseTintForTone(tone: PrizeChaseTone): string {
  return PRIZE_CHASE_TINTS[tone]
}

function prizeChaseWarmForTone(tone: PrizeChaseTone): string {
  return PRIZE_CHASE_WARM[tone]
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
  const [allClaimablePrizesData, setAllClaimablePrizesData] = useState<TopPrizeRow[]>([])
  const [prizeChaseParticipants, setPrizeChaseParticipants] = useState<PrizeChaseParticipant[]>([])
  const [prizeAwardedPairs, setPrizeAwardedPairs] = useState<{ participant_id: string; reward_id: string }[]>([])
  const [configuredRewardsCount, setConfiguredRewardsCount] = useState(0)
  const [newestRewardId, setNewestRewardId] = useState<string | null>(null)
  const newestClearTimer = useRef<ReturnType<typeof setTimeout>>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // While a scan is on its way to a prize celebration the teal panel must not
  // spoil the win: fetches keep running, but their prize half is parked here
  // and applied the moment the celebration takes over the screen.
  const prizeHoldRef = useRef(false)
  const pendingPrizeSnapshotRef = useRef<PrizePanelSnapshot | null>(null)
  const pendingNewestRewardIdRef = useRef<string | null>(null)

  const applyPrizeSnapshot = useCallback((snap: PrizePanelSnapshot) => {
    if (prizeHoldRef.current) {
      pendingPrizeSnapshotRef.current = snap
      return
    }
    setPrizeAwardedPairs(snap.awardedPairs)
    if (snap.chaseParticipants) setPrizeChaseParticipants(snap.chaseParticipants)
    if (snap.rewards) setRewardsData(snap.rewards)
    if (snap.allClaimable) {
      setAllClaimablePrizesData(snap.allClaimable)
      setTopPrizesData(snap.allClaimable.slice(0, 3))
    }
  }, [])

  const flashNewestReward = useCallback((id: string) => {
    if (prizeHoldRef.current) {
      pendingNewestRewardIdRef.current = id
      return
    }
    clearTimeout(newestClearTimer.current)
    setNewestRewardId(id)
    newestClearTimer.current = setTimeout(() => setNewestRewardId(null), 2200)
  }, [])

  const holdPrizeReveal = useCallback((hold: boolean) => {
    prizeHoldRef.current = hold
    if (hold) return
    const snap = pendingPrizeSnapshotRef.current
    const newest = pendingNewestRewardIdRef.current
    pendingPrizeSnapshotRef.current = null
    pendingNewestRewardIdRef.current = null
    if (snap) applyPrizeSnapshot(snap)
    if (newest) flashNewestReward(newest)
  }, [applyPrizeSnapshot, flashNewestReward])

  const fetchAll = useCallback(async () => {
    if (!eventId) return
    try {
      const [gRes, pRes, txRes, countRes, pointsRes, actRes, partRes, completionRes, rwRes, activeRewardsRes, configuredRwRes] = await Promise.all([
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
          .select('id, name, participant_groups(group_id)')
          .eq('event_id', eventId),
        supabase
          .from('point_transactions')
          .select('participant_id, action_id, created_at')
          .eq('event_id', eventId),
        supabase
          .from('participant_rewards')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select('id, participant_id, reward_id, awarded_at, reward:rewards(name, required_points), participant:participants(name)' as any)
          .eq('event_id', eventId)
          .order('awarded_at', { ascending: false }),
        supabase
          .from('rewards')
          .select('id, name, required_points, target_type, target_participant_id, winner_mode, reward_groups(group_id)')
          .eq('event_id', eventId)
          .eq('is_active', true)
          .order('required_points', { ascending: true }),
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

      const participantsForPrizes = (partRes.data ?? []).map((p) => {
        const joins = (p.participant_groups as unknown as { group_id: string }[]) ?? []
        return {
          id: p.id as string,
          groupIds: joins.map((join) => join.group_id).filter(Boolean),
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allAwardRows = (rwRes.data ?? []) as any[]
      const awardedPairs = allAwardRows.map((r) => ({
        participant_id: r.participant_id as string,
        reward_id: r.reward_id as string,
      }))
      const prizeSnapshot: PrizePanelSnapshot = {
        awardedPairs,
        chaseParticipants: null,
        rewards: null,
        allClaimable: null,
      }

      const pointsByParticipant = new Map<string, number>()
      if (pRes.data) {
        for (const row of pRes.data as ParticipantLeaderboardEntry[]) {
          pointsByParticipant.set(row.participant_id, row.total_points)
        }
      }
      if (partRes.data) {
        const seenParticipantIds = new Set<string>()
        prizeSnapshot.chaseParticipants = partRes.data.flatMap((p) => {
          const id = p.id as string
          if (seenParticipantIds.has(id)) return []
          seenParticipantIds.add(id)
          const joins = (p.participant_groups as unknown as { group_id: string }[]) ?? []
          return [{
            id,
            name: (p.name as string) || '---',
            groupIds: joins.map((join) => join.group_id).filter(Boolean),
            totalPoints: pointsByParticipant.get(id) ?? 0,
          }]
        })
      }

      if (rwRes.data) {
        prizeSnapshot.rewards = allAwardRows.slice(0, 5).map(r => {
          const reward = Array.isArray(r.reward) ? r.reward[0] : r.reward
          const participant = Array.isArray(r.participant) ? r.participant[0] : r.participant
          const pts: number = reward?.required_points ?? 0
          const { icon, accent } = rewardTier(pts)
          return {
            id: r.id,
            icon,
            title: reward?.name ?? '---',
            recipient: participant?.name ?? '---',
            score: pts,
            accent,
            createdAt: (r.awarded_at as string) ?? '',
          }
        })
      }

      if (activeRewardsRes.data) {
        const groupNames = new Map<string, string>()
        if (gRes.data) {
          for (const g of gRes.data as GroupLeaderboardEntry[]) {
            groupNames.set(g.group_id, g.group_name)
          }
        }

        const claimableRewards: ClaimableRewardDef[] = activeRewardsRes.data.map((r) => {
          const joins = (r.reward_groups as unknown as { group_id: string }[]) ?? []
          const targetType = (r.target_type as RewardTargetingFields['target_type']) ?? 'all'
          return {
            id: r.id,
            name: r.name,
            required_points: r.required_points,
            target_type: targetType === 'participant' ? 'all' : targetType,
            target_participant_id: null,
            winner_mode: (r.winner_mode as RewardTargetingFields['winner_mode']) ?? 'all',
            groupIds: joins.map((join) => join.group_id).filter(Boolean),
          }
        })
        const allClaimable = pickNextClaimableTopPrizes(
          claimableRewards,
          participantsForPrizes,
          awardedPairs,
          groupNames,
          100,
        )
        prizeSnapshot.allClaimable = allClaimable
      }

      applyPrizeSnapshot(prizeSnapshot)
      setConfiguredRewardsCount(configuredRwRes.count ?? 0)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [eventId, applyPrizeSnapshot])

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
          flashNewestReward(id)
          fetchAll()
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
    topPrizes: topPrizesData,
    allClaimablePrizes: allClaimablePrizesData,
    prizeChaseParticipants,
    prizeAwardedPairs,
    configuredRewardsCount, newestRewardId,
    actions: actionsData,
    kioskParticipants,
    actionCompletionIndex,
    stats, totalScans: txCount,
    loading, error, refetch: fetchAll, holdPrizeReveal,
  }
}

// ─── Event branding above scanner ─────────────────────────────────────────────
function EventBrandMark({ event, onLogoClick }: { event: Event; onLogoClick: () => void }) {
  const hasLogo = !!event.logo_url
  const logoSize = 'clamp(120px, 22vh, 220px)'
  const logoStyle = {
    width: logoSize,
    height: logoSize,
    borderRadius: 30,
    opacity: 0.82,
    boxShadow: '0 10px 32px rgba(255,147,102,0.24)',
  } as const
  const nameSlotStyle = {
    width: 'clamp(220px, 33vw, 520px)',
    minHeight: 'clamp(44px, 6.5vh, 56px)',
  } as const
  const logoButtonStyle = {
    border: 'none',
    padding: 0,
    background: 'none',
    cursor: 'pointer',
    display: 'block',
    overflow: 'visible',
  } as const

  // With a logo the name rides at the very top of the centre column, level with
  // the top edge of the side banners, and the logo tucks in just under it. It
  // is absolutely positioned and the wrapper reserves no room for it, so the
  // name costs the scanner card nothing.
  const namePlacement: React.CSSProperties = hasLogo
    ? { top: 0, transform: 'translateX(-50%)' }
    : { top: '50%', transform: 'translate(-50%, -50%)' }

  return (
    <div className="kiosk-fadeUp" style={{
      flexShrink: 0,
      position: 'relative',
      display: 'inline-block',
      overflow: 'visible',
      maxWidth: '100%',
    }}>
      <button
        type="button"
        onClick={onLogoClick}
        aria-label="מעבר לדף הבית"
        style={{ ...logoButtonStyle, position: 'relative' }}
      >
        {hasLogo ? (
          <img
            src={event.logo_url!}
            alt=""
            style={{ ...logoStyle, objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div aria-hidden="true" style={{ ...nameSlotStyle, visibility: 'hidden' }} />
        )}
        <span style={{
          position: 'absolute',
          left: '50%',
          ...namePlacement,
          display: 'block',
          width: nameSlotStyle.width,
          fontWeight: 900,
          fontSize: 'clamp(16px, 2.2vh, 24px)',
          color: '#2E221E',
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          padding: '6px 16px',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.82)',
          boxShadow: '0 0 14px rgba(255,255,255,0.95), 0 0 28px rgba(255,255,255,0.7)',
          textShadow: '0 0 10px #fff, 0 0 18px rgba(255,255,255,0.9)',
          whiteSpace: 'normal',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}>
          {event.name}
        </span>
      </button>
    </div>
  )
}

// ─── "Participant is in, waiting for the task card" overlay ──────────────────
// Greets the scanned participant by name so they can see the machine picked up
// the right card before they commit to a task.

const WAIT_RING_RADIUS = 34
const WAIT_RING_CIRCUMFERENCE = 2 * Math.PI * WAIT_RING_RADIUS

function AwaitingSecondScanOverlay({
  participantName,
  seconds,
  progress,
}: {
  /** Null when the code matched no participant - greeting falls back to neutral. */
  participantName: string | null
  seconds: number
  progress: number
}) {
  return (
    <div
      className="kiosk-waitPanel"
      style={{
        position: 'absolute', inset: 0, zIndex: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 'clamp(8px, 1.4vh, 16px)',
        background: 'radial-gradient(circle at 50% 42%,rgba(255,250,246,0.95),rgba(255,238,226,0.9))',
        backdropFilter: 'blur(4px)', textAlign: 'center', padding: '0 6%',
      }}
    >
      {/* Card + halo + draining ring */}
      <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
        <div className="kiosk-waitHalo" style={{
          position: 'absolute', inset: -14, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(255,147,102,0.45),transparent 70%)',
        }} />
        <div className="kiosk-waitPing" style={{
          position: 'absolute', inset: -6, borderRadius: '50%',
          border: '2px solid rgba(239,138,78,0.5)',
        }} />

        <svg viewBox="0 0 80 80" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle className="kiosk-waitRingTrack" cx="40" cy="40" r={WAIT_RING_RADIUS} fill="none" strokeWidth="4" />
          <circle
            className="kiosk-waitRingFill"
            cx="40" cy="40" r={WAIT_RING_RADIUS} fill="none" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={WAIT_RING_CIRCUMFERENCE}
            strokeDashoffset={WAIT_RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)))}
          />
        </svg>

        <div className="kiosk-waitCard" style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 38,
        }}>🙋</div>
      </div>

      <div style={{ fontSize: 'clamp(19px, 2.4vh, 26px)', fontWeight: 900, color: '#2E221E' }}>
        {participantName ? `שלום ${participantName}!` : 'שלום!'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 'clamp(14px, 1.8vh, 17px)', fontWeight: 800, color: '#B4552A' }}>
          מחכים לתיקוף שלך
        </span>
        <span style={{ display: 'flex', gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="kiosk-waitDot" style={{
              width: 5, height: 5, borderRadius: '50%', background: '#EF8A4E',
              animationDelay: `${i * 0.16}s`,
            }} />
          ))}
        </span>
      </div>

      {/* The two slots - participant filled, task still waiting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 999,
          background: 'linear-gradient(135deg,#FF9366,#F2B33C)', color: '#fff',
          fontSize: 13, fontWeight: 900, boxShadow: '0 6px 16px rgba(255,147,102,0.35)',
        }}>
          <span>🙋</span>משתתף<span>✓</span>
        </div>

        <span style={{ fontSize: 15, color: '#B4552A', opacity: 0.6 }}>←</span>

        <div className="kiosk-waitSlot" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 999,
          border: '2px dashed rgba(239,138,78,0.6)', color: '#B4552A',
          fontSize: 13, fontWeight: 900,
        }}>
          <span style={{ opacity: 0.65 }}>🎯</span>משימה
        </div>
      </div>

      <div style={{ fontSize: 'clamp(13px, 1.7vh, 15px)', fontWeight: 700, color: '#7D706A', lineHeight: 1.4 }}>
        סרקו עכשיו את כרטיס המשימה כדי לזכות בנקודות
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: '#B4552A', opacity: 0.85 }}>
        ממתין עוד {seconds} שניות
      </div>
    </div>
  )
}

// ─── Decorative scanner frame (design-handoff spec) ──────────────────────────
function ScannerFrame({
  processing,
  locked,
  awaiting,
  awaitingName,
  awaitingSeconds = 0,
  waitProgress = 0,
}: {
  processing: boolean
  locked?: boolean
  /** A participant card is scanned; the scanner is holding for their task card. */
  awaiting?: boolean
  awaitingName?: string | null
  awaitingSeconds?: number
  waitProgress?: number
}) {
  return (
    <div className="kiosk-fadeUp kiosk-scannerFrame" style={{ animationDelay: '0.1s' }}>
      {/* Rotating conic glow ring */}
      <div className="kiosk-hueRing" style={{
        position: 'absolute', inset: '-9%', borderRadius: '50%',
        background: 'conic-gradient(from 0deg,#FF9366,#F2B33C,#FFCB9A,#8FCFA0,#5FB3AA,#FF9366)',
        opacity: 0.20, filter: 'blur(9px)',
      }} />
      {/* Gradient border box */}
      <div className="kiosk-scannerBorderOuter" style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg,#FF9366,#F2B33C 40%,#FFCB9A 70%,#8FCFA0)',
        padding: 5, boxShadow: '0 22px 60px rgba(171,53,0,0.16)',
      }}>
        <div className="kiosk-scannerBorderInner" style={{
          width: '100%', height: '100%', overflow: 'hidden',
          background: 'linear-gradient(160deg,#FFFFFF,#FFF1EC)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* Dot grid texture */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(255,147,102,0.09) 1.5px,transparent 1.6px)', backgroundSize: '26px 26px' }} />

          {/* QR card - scales with scanner frame */}
          <div className="kiosk-wobble kiosk-scannerParticipantCard" style={{
            background: '#fff',
            boxShadow: '0 16px 40px rgba(171,53,0,0.18)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            position: 'relative', zIndex: 2,
          }}>
            <div className="kiosk-scannerQrMatrix" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(21, 1fr)',
              gridTemplateRows: 'repeat(21, 1fr)',
            }}>
              {QR_MATRIX.flat().map((v, i) => (
                <div key={i} style={{ background: v ? '#AB3500' : '#ffffff' }} />
              ))}
            </div>
            <div className="kiosk-scannerParticipantLabel" style={{ fontWeight: 800, color: '#7D706A' }}>כרטיס המשתתף</div>
          </div>

          {/* Corner brackets */}
          <div className="kiosk-blink kiosk-scannerCorner kiosk-scannerCorner--tr" style={{ position: 'absolute', borderTop: '5px solid #FF9366', borderRight: '5px solid #FF9366', borderTopRightRadius: 14, boxShadow: '0 0 12px rgba(255,147,102,0.35)' }} />
          <div className="kiosk-blink kiosk-scannerCorner kiosk-scannerCorner--tl" style={{ position: 'absolute', borderTop: '5px solid #F2B33C', borderLeft: '5px solid #F2B33C', borderTopLeftRadius: 14, boxShadow: '0 0 12px rgba(242,179,60,0.35)', animationDelay: '0.6s' }} />
          <div className="kiosk-blink kiosk-scannerCorner kiosk-scannerCorner--br" style={{ position: 'absolute', borderBottom: '5px solid #5FB3AA', borderRight: '5px solid #5FB3AA', borderBottomRightRadius: 14, boxShadow: '0 0 12px rgba(95,179,170,0.35)', animationDelay: '1.2s' }} />
          <div className="kiosk-blink kiosk-scannerCorner kiosk-scannerCorner--bl" style={{ position: 'absolute', borderBottom: '5px solid #8FCFA0', borderLeft: '5px solid #8FCFA0', borderBottomLeftRadius: 14, boxShadow: '0 0 12px rgba(143,207,160,0.35)', animationDelay: '1.8s' }} />

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

          {/* Participant scanned - holding for their task card */}
          {awaiting && !processing && !locked && (
            <AwaitingSecondScanOverlay
              participantName={awaitingName ?? null}
              seconds={awaitingSeconds}
              progress={waitProgress}
            />
          )}

          {/* Locked overlay - scanning not included in this plan */}
          {locked && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 15,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              background: 'rgba(255,248,243,0.88)', backdropFilter: 'blur(3px)',
            }}>
              <div style={{
                width: 76, height: 76, borderRadius: '50%',
                background: 'linear-gradient(135deg,#4A3C36,#2E221E)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 10px 28px rgba(46,34,30,0.32)',
              }}>
                <span style={{ fontSize: 36, lineHeight: 1 }}>🔒</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#2E221E' }}>הסריקה נעולה</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#7D706A' }}>השתמשו בהזנה ידנית</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Inline manual-entry panel (independent plan - no scanner) ───────────────
// The independent plan never scans, so instead of a locked scanner we surface the
// manual-entry inputs directly - no button, styled to match the festive kiosk.
function KioskManualEntryPanel({
  eventId, submitting, onSubmit, catalog, availability, gameStarted,
}: {
  eventId: string
  submitting: boolean
  onSubmit: (participantCode: string, actionCode: string) => Promise<void>
  catalog: React.ComponentProps<typeof ManualEntryForm>['catalog']
  availability?: ManualEntryAvailability
  gameStarted: boolean
}) {
  return (
    <div className="kiosk-fadeUp" style={{
      animationDelay: '0.1s',
      position: 'relative',
      width: 'min(430px, 100%)',
      maxWidth: '100%',
      flexShrink: 0,
    }}>
      {/* Rotating conic glow ring - echoes the scanner frame */}
      <div className="kiosk-hueRing" style={{
        position: 'absolute', inset: '-7%', borderRadius: 34,
        background: 'conic-gradient(from 0deg,#FF9366,#F2B33C,#FFCB9A,#8FCFA0,#5FB3AA,#FF9366)',
        opacity: 0.18, filter: 'blur(11px)', zIndex: 0,
      }} />

      {/* Gradient border card */}
      <div style={{
        position: 'relative', zIndex: 1, borderRadius: 28, padding: 4,
        background: 'linear-gradient(135deg,#FF9366,#F2B33C 40%,#FFCB9A 70%,#8FCFA0)',
        boxShadow: '0 22px 60px rgba(171,53,0,0.16)',
      }}>
        <div style={{
          borderRadius: 24, background: 'linear-gradient(160deg,#FFFFFF,#FFF6F0)',
          padding: 'clamp(18px, 2vw, 28px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <div className="kiosk-bob" style={{
              width: 62, height: 62, borderRadius: 18,
              background: 'linear-gradient(135deg,#FF9366,#F2B33C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, boxShadow: '0 10px 24px rgba(255,147,102,0.4)',
            }}>⌨️</div>
            <div style={{ fontSize: 'clamp(20px, 2vw, 24px)', fontWeight: 900, color: '#2E221E' }}>הזנה ידנית</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#7D706A', lineHeight: 1.4 }}>
              {gameStarted
                ? 'בחרו שחקן ומשימה - הנקודות נזקפות מיד'
                : 'בחרו את המשתתף הראשון כדי לפתוח את התחרות'}
            </div>
          </div>

          {/* The inputs - always visible, no button to reveal them */}
          <ManualEntryForm
            eventId={eventId}
            accent={KIOSK_ACCENT}
            submitting={submitting}
            onSubmit={onSubmit}
            catalog={catalog}
            availability={availability}
            bare
          />
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
      {/* Layer 1 - glow background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 46%,rgba(255,236,190,0.94),rgba(255,248,200,0.75) 60%,rgba(255,220,160,0.85) 100%)',
        animation: reducedMotion ? 'none' : 'kiosk-glowPulse 2.4s ease-in-out infinite',
      }} />

      {/* Layer 2 - rotating rays */}
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

      {/* Layer 3 - confetti rain */}
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

      {/* Layer 4 - coin burst from center */}
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

      {/* Layer 5 - center content */}
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
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div className="kiosk-twinkle kiosk-floatY-4" style={{ position: 'absolute', top: 70, left: 20, fontSize: 18, filter: 'drop-shadow(0 0 7px rgba(255,255,255,0.95))' }}>✨</div>
      <div className="kiosk-twinkle kiosk-floatY-2" style={{ position: 'absolute', top: 150, right: 16, fontSize: 14, filter: 'drop-shadow(0 0 7px rgba(255,246,214,0.95))' }}>⭐</div>
      <div className="kiosk-twinkle" style={{ position: 'absolute', top: 250, left: 14, width: 7, height: 7, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px 2px rgba(255,255,255,0.9)' }} />
      <div className="kiosk-twinkle kiosk-floatY-3" style={{ position: 'absolute', bottom: 150, right: 22, fontSize: 16, filter: 'drop-shadow(0 0 7px rgba(255,246,214,0.95))' }}>✨</div>
      <div className="kiosk-twinkle kiosk-floatY-1" style={{ position: 'absolute', bottom: 70, left: 24, fontSize: 14, filter: 'drop-shadow(0 0 7px rgba(255,255,255,0.95))' }}>⭐</div>
      <div className="kiosk-twinkle" style={{ position: 'absolute', top: 330, right: 18, width: 6, height: 6, borderRadius: '50%', background: '#fff', boxShadow: '0 0 8px 2px rgba(255,255,255,0.85)' }} />
    </div>
  )
}

function AwardedRewardsFeed({ rewards, newestId, now }: { rewards: RewardRow[]; newestId: string | null; now: Date }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span className="kiosk-blink" style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFFFFF', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '1.5px', color: '#FFFFFF' }}>פרסים אחרונים</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 7, overflow: 'hidden' }}>
        {rewards.map((r, i) => {
          const isNew = r.id === newestId
          const relativeTime = formatActivityRelativeTime(r.createdAt, now)
          return (
            <div
              key={r.id}
              className={[
                'kiosk-activityRow',
                isNew ? 'kiosk-rewardIn kiosk-goldPulse' : 'kiosk-fadeUp',
              ].filter(Boolean).join(' ')}
              style={{
                position: 'relative',
                overflow: 'hidden',
                animationDelay: isNew ? '0s' : `${0.05 + i * 0.07}s`,
                ['--kiosk-row-accent' as string]: '#F2B33C',
              } as React.CSSProperties}
            >
              {isNew && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                  <div className="kiosk-shimmerSweep" style={{
                    position: 'absolute', top: 0, bottom: 0, width: '40%',
                    background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)',
                    animationIterationCount: 1,
                  }} />
                </div>
              )}

              <div className="kiosk-activityRowContent">
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{r.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }} className="kiosk-activityRowText">
                  <div className="kiosk-activityRowTitle" style={{ fontWeight: 900, fontSize: 13, color: '#2E221E' }}>
                    {r.title}
                  </div>
                  <div className="kiosk-activityRowSubtitle">
                    <span className="kiosk-activityRowName">{r.recipient}</span>
                    {relativeTime && (
                      <>
                        <span className="kiosk-activityRowMetaSep"> · </span>
                        <span className="kiosk-activityRowTime">{relativeTime}</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  background: 'linear-gradient(145deg,#FFFFFF,#FFF4E0)',
                  border: '1.5px solid rgba(242,179,60,0.75)', borderRadius: 999,
                  padding: '2px 6px 2px 4px',
                }}>
                  <span style={{ fontSize: 9, lineHeight: 1, filter: 'drop-shadow(0 0 4px rgba(242,179,60,0.5))' }}>⭐</span>
                  <span style={{
                    display: 'inline-flex', direction: 'ltr', alignItems: 'baseline',
                    fontSize: 12, fontWeight: 900, color: '#C8941A', lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {r.score.toLocaleString('he-IL')}
                  </span>
                </div>
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

function RewardsPreGameFeed() {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="kiosk-fadeUp kiosk-cardBreathe" style={{
        position: 'relative', borderRadius: 22, padding: 22,
        background: '#FFFFFF', boxShadow: '0 10px 24px rgba(120,50,10,0.18)',
        color: '#2E221E', border: '1.5px solid #FFD8BC', overflow: 'hidden',
        textAlign: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div className="kiosk-shimmerSweep" style={{ position: 'absolute', top: 0, bottom: 0, width: '42%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.58),transparent)' }} />
        </div>
        <div className="kiosk-bob" style={{ fontSize: 32, lineHeight: 1, position: 'relative' }}>🎉</div>
        <div style={{ marginTop: 8, fontSize: 17, fontWeight: 900, lineHeight: 1.3, position: 'relative' }}>
          עדיין לא חולקו פרסים
        </div>
        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: '#7D706A', position: 'relative' }}>
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
      <div className="kiosk-fadeUp" style={{
        borderRadius: 22, padding: 22,
        background: '#FFFFFF', boxShadow: '0 10px 24px rgba(120,50,10,0.18)',
        color: '#2E221E', border: '1.5px solid #FFD8BC',
        textAlign: 'center',
      }}>
        <div className="kiosk-bob" style={{ fontSize: 32, lineHeight: 1 }}>🏆</div>
        <div style={{ marginTop: 8, fontSize: 17, fontWeight: 900, lineHeight: 1.3 }}>
          עוד רגע נראה כאן זוכים
        </div>
        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: '#7D706A', lineHeight: 1.35 }}>
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
      <div className="kiosk-fadeUp" style={{
        borderRadius: 22, padding: 22,
        background: '#FFFFFF', boxShadow: '0 10px 24px rgba(120,50,10,0.18)',
        color: '#2E221E', border: '1.5px solid #FFD8BC',
        textAlign: 'center',
      }}>
        <div className="kiosk-bob" style={{ fontSize: 32, lineHeight: 1 }}>🏁</div>
        <div style={{ marginTop: 8, fontSize: 17, fontWeight: 900, lineHeight: 1.3 }}>
          המרוץ לפרסים כבר התחיל
        </div>
        <div style={{ marginTop: 5, fontSize: 14, fontWeight: 800, color: '#7D706A', lineHeight: 1.35 }}>
          המשתתפים כבר צוברים נקודות. עוד קצת, והפרס הראשון ייפתח!
        </div>
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: '#9A8E88', lineHeight: 1.35 }}>
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
        borderRadius: 22, padding: 22,
        background: '#FFFFFF', boxShadow: '0 10px 24px rgba(120,50,10,0.18)',
        color: '#2E221E', border: '1.5px solid #FFD8BC',
        textAlign: 'center', overflow: 'hidden',
      }}>
        <div className="kiosk-bob" style={{ fontSize: 34, lineHeight: 1 }}>🎁</div>
        <div style={{ marginTop: 9, fontSize: 17, fontWeight: 900, lineHeight: 1.3 }}>
          הפרס הראשון מתחיל כאן
        </div>
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: '#7D706A', lineHeight: 1.42 }}>
          צרו את הפרס הראשון והפכו כל נקודה לרגע של התרגשות.
        </div>
        <button
          onClick={onCreate}
          style={{
            marginTop: 14,
            border: 'none',
            borderRadius: 999,
            background: 'linear-gradient(135deg,#FF9366,#F2B33C)',
            color: '#FFFFFF',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 900,
            padding: '10px 18px',
            boxShadow: '0 6px 16px rgba(255,147,102,0.35)',
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
          כולם מחכים לפעולה הראשונה
        </div>
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.84)', lineHeight: 1.45 }}>
          ברגע שתתבצע הפעולה הראשונה, יתחיל כל הכיף!
        </div>
      </div>
      <SkeletonRows count={3} />
    </div>
  )
}

const ACTIVITY_MAX_SLOTS = 10
const ACTIVITY_ROTATE_MS = 4_200
const ACTIVITY_ROW_EST_HEIGHT = 58
const ACTIVITY_ROW_GAP = 10
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

    // Data arrived after initial empty state - treat as baseline, not new scans.
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
    overflow: 'hidden',
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
/** Stagger prize card swaps so they never align with mission rotation. */
const PRIZE_ROTATE_OFFSET_MS = 7_500
const MISSION_POINTS_DELAY_MS = 400
const PRIZE_POINTS_DELAY_MS = 550

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
    const t = window.setTimeout(() => setShowPoints(true), MISSION_POINTS_DELAY_MS)
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
    <div style={{ position: 'absolute', bottom: -16, left: -18, zIndex: 40, pointerEvents: 'none' }}>
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

  const pointsPhase: 'idle' | 'out' | 'in' = phase === 'exit' ? 'out' : 'idle'
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
            pointsSwapPhase={pointsPhase}
          />
        </div>
      )}
    </div>
  )
}


function PrizePointsBadge({
  prize,
  reducedMotion,
  swapPhase,
}: {
  prize: TopPrizeRow | null
  reducedMotion: boolean
  swapPhase: 'idle' | 'out' | 'in'
}) {
  const [showPoints, setShowPoints] = useState(reducedMotion)
  const prizeId = prize?.id ?? null

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
    const t = window.setTimeout(() => setShowPoints(true), PRIZE_POINTS_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [prizeId, reducedMotion, swapPhase])

  if (!showPoints || !prize) {
    return <div style={{ marginTop: 10, minHeight: 48 }} aria-hidden />
  }

  return (
    <div
      style={{
        marginTop: 10,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        key={prizeId ?? 'none'}
        className={reducedMotion ? undefined : 'kiosk-prizeTargetReveal'}
        style={{
          width: '100%',
          maxWidth: 200,
          padding: '8px 14px',
          borderRadius: 14,
          textAlign: 'center',
          background: 'linear-gradient(165deg, #EAF7F5 0%, #FFFFFF 55%)',
          border: '2px solid rgba(90,181,173,0.5)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 12px rgba(46,120,112,0.12)',
        }}
      >
        <div
          className={reducedMotion ? undefined : 'kiosk-prizeTargetGlow'}
          style={{
            display: 'inline-flex',
            direction: 'ltr',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 4,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 900, color: '#5AB5AD' }}>נק׳</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: '#2A7A73' }}>
            {prize.requiredPoints.toLocaleString('he-IL')}
          </span>
        </div>
      </div>
    </div>
  )
}


function TopPrizeCard({
  prize, reducedMotion = false, entering = false, swapRole, swapPhase = 'idle',
}: {
  prize: TopPrizeRow | null
  reducedMotion?: boolean
  entering?: boolean
  swapRole?: 'in' | 'out'
  swapPhase?: 'idle' | 'out' | 'in'
}) {
  return (
    <div
      className={[
        'kiosk-missionCard',
        swapRole === 'out' ? 'kiosk-missionCard--swapOut' : '',
        swapRole === 'in' ? 'kiosk-missionCard--swapIn' : '',
      ].filter(Boolean).join(' ')}
      style={{
        position: 'relative', zIndex: 1, borderRadius: 20,
        boxSizing: 'border-box', width: '100%',
        padding: '40px 16px 14px',
        background: '#FFFFFF', boxShadow: '0 8px 20px rgba(46,120,112,0.2)',
        overflow: 'visible', color: '#2E221E',
        border: '2px solid rgba(90,181,173,0.55)',
      }}
    >
      {prize && swapRole !== 'out' && (
        <div className="kiosk-missionTypeBadgeAnchor" aria-hidden>
          <div
            key={prize.id}
            className={[
              'kiosk-missionTypeBadge',
              'kiosk-missionTypeBadge--prize',
              entering && !reducedMotion ? 'kiosk-missionTypeBadge--enter' : '',
            ].filter(Boolean).join(' ')}
          >
            פרס הבא
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', top: -24, left: -18, width: 96, height: 96, borderRadius: '50%', background: 'rgba(90,181,173,0.12)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 20, pointerEvents: 'none' }}>
        <div className="kiosk-shimmerSweep" style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)' }} />
      </div>

      {prize && (
        <div
          className="kiosk-floatY-2"
          style={{
            position: 'absolute', top: -20, left: -18, zIndex: 30,
            width: 62, height: 62,
          }}
        >
          <div
            className="kiosk-pulseGlow"
            style={{
              position: 'absolute', inset: -5, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(90,181,173,0.45) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            className={entering ? 'kiosk-missionSwapIconPop' : 'kiosk-fireFlicker'}
            style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', height: '100%',
              background: 'linear-gradient(145deg,#FFFFFF,#E8F7F5)',
              borderRadius: '50%',
              fontSize: 44, lineHeight: 1,
              border: '2.5px solid rgba(56,136,130,0.75)',
              boxShadow: '0 8px 20px rgba(46,120,112,0.24), 0 0 0 4px rgba(255,255,255,0.9), 0 0 16px rgba(90,181,173,0.28)',
            }}
          >
            <span aria-hidden>{prize.icon}</span>
          </div>
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ marginTop: 4, maxWidth: '100%' }}>
          <div
            className={
              reducedMotion
                ? undefined
                : entering
                  ? 'kiosk-missionSwapTitleIn'
                  : 'kiosk-missionNameFlash'
            }
            style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.15 }}
          >
            <ShimmerText text={prize?.name ?? '---'} />
          </div>
          {prize && (prize.targetType !== 'all' || prize.winnerMode === 'first') && (
            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#5A8F89', lineHeight: 1.3 }}>
              {getRewardScopeLabel({
                target_type: prize.targetType,
                target_participant_id: null,
                winner_mode: prize.winnerMode,
                groupIds: prize.groupIds,
              }, { groupName: prize.groupName })}
            </div>
          )}
        </div>
        <PrizePointsBadge prize={prize} reducedMotion={reducedMotion} swapPhase={swapPhase} />
      </div>
    </div>
  )
}


function PrizeChaseCard({
  row,
  chaserIndex,
  entering = false,
  reducedMotion,
}: {
  row: PrizeChaseRow
  chaserIndex: number
  entering?: boolean
  reducedMotion: boolean
}) {
  const { text: nudge, hot, tone, icon } = getPrizeChaseNudge(row, chaserIndex)
  const accent = prizeChaseAccentForTone(tone)
  const tint = prizeChaseTintForTone(tone)
  const warm = prizeChaseWarmForTone(tone)
  const gapLabel = row.gap === 0
    ? 'מוכן לזכייה!'
    : `${row.gap.toLocaleString('he-IL')} נק׳`

  return (
    <div
      className={[
        'kiosk-prizeChaseCard',
        `kiosk-prizeChaseCard--${tone}`,
        hot ? 'kiosk-prizeChaseCard--hot' : '',
        entering && !reducedMotion ? 'kiosk-prizeChaseCard--enter' : '',
      ].filter(Boolean).join(' ')}
      style={{
        ['--kiosk-chase-accent' as string]: accent,
        ['--kiosk-chase-tint' as string]: tint,
        ['--kiosk-chase-warm' as string]: warm,
      }}
    >
      <div
        className={[
          'kiosk-prizeChaseIconBadge',
          hot && !reducedMotion ? 'kiosk-prizeChaseIconBadge--hot' : '',
          entering && !reducedMotion ? 'kiosk-prizeChaseIconBadge--enter' : '',
        ].filter(Boolean).join(' ')}
        aria-hidden
      >
        {icon}
      </div>
      <div className="kiosk-prizeChaseBody">
        <div className="kiosk-prizeChaseHeader">
          <div className="kiosk-prizeChaseNameRow">
            <span className="kiosk-prizeChaseName" title={row.name}>{row.name}</span>
            <span
              className={[
                'kiosk-prizeChaseNudge',
                entering && !reducedMotion ? 'kiosk-prizeChaseNudge--enter' : '',
                hot && !reducedMotion && !entering ? 'kiosk-prizeChaseNudge--hot' : '',
                !hot && !reducedMotion && !entering ? 'kiosk-prizeChaseNudge--glow' : '',
              ].filter(Boolean).join(' ')}
            >
              {nudge}
            </span>
          </div>
          <span className={[
            'kiosk-prizeChaseGapPill',
            hot && !reducedMotion ? 'kiosk-prizeChaseGapPill--hot' : '',
          ].filter(Boolean).join(' ')}>
            <span className="kiosk-prizeChaseGapIcon" aria-hidden>⭐</span>
            {row.gap > 0 && <span className="kiosk-prizeChaseGapPrefix">עוד</span>}
            {gapLabel}
          </span>
        </div>
        <div className="kiosk-prizeChaseTrack">
          <div
            className={[
              'kiosk-prizeChaseFill',
              entering && !reducedMotion ? 'kiosk-prizeChaseFill--enter' : '',
            ].filter(Boolean).join(' ')}
            style={{ width: `${Math.max(row.progressPct, row.progressPct > 0 ? 6 : 0)}%` }}
          />
        </div>
      </div>
    </div>
  )
}


function PrizeChaseStackView({
  chasers,
  gameStarted,
  reducedMotion,
  onCycleComplete,
}: {
  chasers: PrizeChaseRow[]
  gameStarted: boolean
  reducedMotion: boolean
  onCycleComplete?: () => void
}) {
  const chaserIds = chasers.map((c) => c.participantId).join(',')
  const maxVisible = PRIZE_CHASE_MAX_VISIBLE
  const pushesNeeded = Math.max(0, chasers.length - 1)
  // Seeded from the current `chasers` snapshot this instance was mounted with.
  // The parent re-keys this component whenever the chaser set changes (see
  // PrizeChasePanel), so every index we ever hold is generated against - and
  // lives no longer than - the exact `chasers` array it points into.
  const [visibleIndices, setVisibleIndices] = useState<number[]>(() =>
    reducedMotion && chasers.length > 0
      ? Array.from({ length: Math.min(maxVisible, chasers.length) }, (_, i) => i)
      : chasers.length > 0 ? [0] : [],
  )
  const [phase, setPhase] = useState<'idle' | 'push'>('idle')
  const [rotateIncomingIdx, setRotateIncomingIdx] = useState<number | null>(null)
  const [pushesDone, setPushesDone] = useState(0)
  const cycleCompleteRef = useRef(false)
  const cycleCompleteTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const onCycleCompleteRef = useRef(onCycleComplete)
  onCycleCompleteRef.current = onCycleComplete

  const markCycleComplete = useCallback((dwellMs: number) => {
    if (cycleCompleteRef.current) return
    cycleCompleteRef.current = true
    if (cycleCompleteTimerRef.current !== undefined) {
      window.clearTimeout(cycleCompleteTimerRef.current)
    }
    cycleCompleteTimerRef.current = setTimeout(() => {
      cycleCompleteTimerRef.current = undefined
      onCycleCompleteRef.current?.()
    }, dwellMs) as ReturnType<typeof setTimeout>
  }, [])

  // A changed chaser set remounts this component (keyed by the parent), which
  // resets every piece of animation state to a fresh, valid snapshot. The only
  // thing a remount can't reclaim on its own is a still-pending cycle-complete
  // timer, so clear that on unmount to avoid a stray prize advance.
  useEffect(
    () => () => {
      if (cycleCompleteTimerRef.current !== undefined) {
        window.clearTimeout(cycleCompleteTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!gameStarted || chasers.length === 0 || cycleCompleteRef.current) return
    if (reducedMotion || chasers.length === 1) {
      markCycleComplete(reducedMotion ? 0 : PRIZE_CHASE_ROTATE_MS)
    }
  }, [gameStarted, chasers.length, chaserIds, reducedMotion, markCycleComplete])

  useEffect(() => {
    if (!gameStarted || chasers.length <= 1 || reducedMotion || phase === 'push') return
    if (pushesDone >= pushesNeeded || cycleCompleteRef.current) return
    const t = window.setInterval(() => {
      setVisibleIndices((prev) => {
        if (prev.length === 0) return prev
        const highestShown = Math.max(...prev)
        const incomingIdx = highestShown + 1
        if (incomingIdx >= chasers.length) return prev
        setRotateIncomingIdx(incomingIdx)
        setPhase('push')
        return prev
      })
    }, PRIZE_CHASE_ROTATE_MS)
    return () => window.clearInterval(t)
  }, [gameStarted, chasers.length, reducedMotion, phase, chaserIds, pushesDone, pushesNeeded])

  useEffect(() => {
    if (phase !== 'push') return
    const t = window.setTimeout(() => {
      if (rotateIncomingIdx !== null) {
        setVisibleIndices((prev) => {
          const next = [rotateIncomingIdx, ...prev]
          return next.length > maxVisible ? next.slice(0, maxVisible) : next
        })
        setRotateIncomingIdx(null)
        setPushesDone((prev) => prev + 1)
      }
      setPhase('idle')
    }, reducedMotion ? 0 : 720)
    return () => window.clearTimeout(t)
  }, [phase, rotateIncomingIdx, maxVisible, reducedMotion])

  useEffect(() => {
    if (!gameStarted || chasers.length <= 1 || cycleCompleteRef.current || reducedMotion) return
    if (pushesDone >= pushesNeeded) {
      markCycleComplete(PRIZE_CHASE_ROTATE_MS)
    }
  }, [pushesDone, pushesNeeded, chasers.length, gameStarted, reducedMotion, markCycleComplete, chaserIds])

  const stackRows = useMemo(() => {
    if (phase === 'push' && rotateIncomingIdx !== null) {
      const current = visibleIndices.map((idx) => ({ idx, row: chasers[idx] }))
      const items = [{ idx: rotateIncomingIdx, row: chasers[rotateIncomingIdx] }, ...current]
      return items.map(({ idx, row }, visualIndex) => ({ idx, row, visualIndex }))
    }
    return visibleIndices.map((idx, visualIndex) => ({
      idx,
      row: chasers[idx],
      visualIndex,
    }))
  }, [phase, rotateIncomingIdx, visibleIndices, chasers])

  if (!gameStarted) {
    return (
      <div className="kiosk-prizeChaseEmpty">
        המרוץ יתחיל עם הפעולה הראשונה
      </div>
    )
  }

  if (chasers.length === 0) {
    return (
      <div className="kiosk-prizeChaseEmpty">
        עוד אין מועמדים לפרס הזה
      </div>
    )
  }

  return (
    <div
      className="kiosk-prizeChaseStackWrap"
      style={{ ['--kiosk-activity-row-step' as string]: `${PRIZE_CHASE_ROW_STEP}px` }}
    >
      <div
        className={phase === 'push' && !reducedMotion ? 'kiosk-activityStackPush' : undefined}
        style={{ display: 'flex', flexDirection: 'column', gap: PRIZE_CHASE_ROW_GAP, flexShrink: 0 }}
      >
        {stackRows.map(({ idx, row, visualIndex }) => {
          const isPush = phase === 'push' && !reducedMotion
          const pushCount = stackRows.length
          const isEntering = isPush && visualIndex === 0
          const isFirstReveal = !isPush && visualIndex === 0 && pushesDone === 0 && stackRows.length === 1
          const rowClasses = [
            isEntering ? 'kiosk-activityEnterSide' : '',
            isPush && visualIndex === pushCount - 1 && pushCount > maxVisible ? 'kiosk-activityExitBottom' : '',
          ].filter(Boolean).join(' ')
          return (
            <div key={`${idx}-${row.participantId}`} className={rowClasses || undefined}>
              <PrizeChaseCard
                row={row}
                chaserIndex={idx}
                entering={isEntering || isFirstReveal}
                reducedMotion={reducedMotion}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}


function PrizeChasePanel({
  prize,
  chasers,
  gameStarted,
  reducedMotion,
  onChaseCycleComplete,
}: {
  prize: TopPrizeRow | null
  chasers: PrizeChaseRow[]
  gameStarted: boolean
  reducedMotion: boolean
  onChaseCycleComplete?: () => void
}) {
  if (!prize) return null

  // Identity of the current chaser set. Used as the stack's React key so that
  // any change to who is chasing (or their order) remounts it with state seeded
  // from the new array - the invariant that keeps indices from outliving it.
  const chaserKey = chasers.map((c) => c.participantId).join(',')

  return (
    <div
      key={prize.id}
      className="kiosk-prizeChaseSlot"
    >
      <div className="kiosk-prizeChaseSlotLabel">
        <span className="kiosk-blink kiosk-prizeChaseSlotDot" />
        הכי קרובים לפרס
      </div>
      <div className="kiosk-prizeChaseStackArea">
        <PrizeChaseStackView
          key={`${chaserKey}|${reducedMotion}`}
          chasers={chasers}
          gameStarted={gameStarted}
          reducedMotion={reducedMotion}
          onCycleComplete={onChaseCycleComplete}
        />
      </div>
    </div>
  )
}


function TopPrizeSwap({
  prize, reducedMotion,
}: {
  prize: TopPrizeRow | null
  reducedMotion: boolean
}) {
  const [displayed, setDisplayed] = useState(prize)
  const [exiting, setExiting] = useState<TopPrizeRow | null>(null)
  const [phase, setPhase] = useState<MissionSwapPhase>('idle')
  const pendingRef = useRef(prize)
  const skipAnimRef = useRef(true)

  useEffect(() => {
    pendingRef.current = prize
    if (prize?.id === displayed?.id) {
      setDisplayed(prize)
      return
    }
    if (reducedMotion || skipAnimRef.current) {
      skipAnimRef.current = false
      setDisplayed(prize)
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
  }, [prize, prize?.id, displayed, displayed?.id, reducedMotion, phase])

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

  const pointsPhase: 'idle' | 'out' | 'in' = phase === 'exit' ? 'out' : 'idle'
  const showCard = phase === 'idle' || phase === 'enter'

  return (
    <div className="kiosk-missionSwapStage">
      {phase === 'exit' && exiting && (
        <div key={`exit-${exiting.id}`} className="kiosk-missionSwapLayer kiosk-missionSwapLayer--exit">
          <TopPrizeCard prize={exiting} reducedMotion={reducedMotion} swapRole="out" />
        </div>
      )}
      {showCard && (
        <div
          key={displayed?.id ?? 'none'}
          className={phase === 'enter' ? 'kiosk-missionSwapLayer kiosk-missionSwapLayer--enter' : 'kiosk-missionSwapLayer'}
        >
          {phase === 'enter' && !reducedMotion && <MissionSwapFx />}
          <TopPrizeCard
            prize={displayed}
            reducedMotion={reducedMotion}
            entering={phase === 'enter' && !reducedMotion}
            swapRole={phase === 'enter' ? 'in' : undefined}
            swapPhase={pointsPhase}
          />
        </div>
      )}
    </div>
  )
}


function TopPrizes({
  prizes,
  allClaimablePrizes,
  chaseParticipants,
  awardedPairs,
  gameStarted,
  reducedMotion,
}: {
  prizes: TopPrizeRow[]
  allClaimablePrizes: TopPrizeRow[]
  chaseParticipants: PrizeChaseParticipant[]
  awardedPairs: { participant_id: string; reward_id: string }[]
  gameStarted: boolean
  reducedMotion: boolean
}) {
  if (prizes.length === 0) return null

  const [prizeIdx, setPrizeIdx] = useState(0)
  const prizeIds = prizes.map((p) => p.id).join(',')
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const noChaserOffsetAppliedRef = useRef(false)

  const chaseAssignments = useMemo(
    () => buildParticipantChaseAssignments(allClaimablePrizes, chaseParticipants, awardedPairs),
    [allClaimablePrizes, chaseParticipants, awardedPairs],
  )

  useEffect(() => {
    setPrizeIdx(0)
    noChaserOffsetAppliedRef.current = false
  }, [prizeIds])

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== undefined) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = undefined
    }
  }, [])

  const advancePrize = useCallback(() => {
    if (!gameStarted || prizes.length <= 1) return
    setPrizeIdx((i) => (i + 1) % prizes.length)
  }, [gameStarted, prizes.length])

  const scheduleAdvance = useCallback((delayMs: number) => {
    clearAdvanceTimer()
    advanceTimerRef.current = setTimeout(advancePrize, delayMs)
  }, [clearAdvanceTimer, advancePrize])

  const currentPrize = prizes[prizeIdx] ?? prizes[0] ?? null
  const currentChasers = useMemo(
    () => (currentPrize
      ? getChaseParticipantsForPrize(currentPrize, chaseParticipants, chaseAssignments).slice(0, PRIZE_CHASE_MAX_CANDIDATES)
      : []),
    [currentPrize, chaseParticipants, chaseAssignments],
  )

  const handleChaseCycleComplete = useCallback(() => {
    scheduleAdvance(PRIZE_CHASE_ROTATE_MS)
  }, [scheduleAdvance])

  useEffect(() => {
    if (!gameStarted || prizes.length <= 1 || currentChasers.length > 0) return
    const delay = !noChaserOffsetAppliedRef.current
      ? PRIZE_ROTATE_OFFSET_MS + MISSION_ROTATE_MS
      : MISSION_ROTATE_MS
    noChaserOffsetAppliedRef.current = true
    scheduleAdvance(delay)
    return clearAdvanceTimer
  }, [currentPrize?.id, currentChasers.length, gameStarted, prizes.length, scheduleAdvance, clearAdvanceTimer])

  useEffect(() => {
    if (currentChasers.length > 0) clearAdvanceTimer()
  }, [currentPrize?.id, currentChasers.length, clearAdvanceTimer])

  useEffect(() => () => clearAdvanceTimer(), [clearAdvanceTimer])

  return (
    <div className="kiosk-prizeHeroStack">
      <div className="kiosk-prizeCardSlot">
        <TopPrizeSwap prize={currentPrize} reducedMotion={reducedMotion} />
      </div>
      <PrizeChasePanel
        prize={currentPrize}
        chasers={currentChasers}
        gameStarted={gameStarted}
        reducedMotion={reducedMotion}
        onChaseCycleComplete={handleChaseCycleComplete}
      />
    </div>
  )
}


function RecommendedMissionCard({
  action, now, reducedMotion = false, entering = false, swapRole, pointsSwapPhase = 'idle',
}: {
  action: KioskAction | null
  now: Date
  reducedMotion?: boolean
  entering?: boolean
  swapRole?: 'in' | 'out'
  pointsSwapPhase?: 'idle' | 'out' | 'in'
}) {
  const inDailyWindow = action ? isInDailyTimeWindow(action, now) : false
  const dailyWindow = action ? getDailyTimeWindow(action) : { start: null, end: null }
  const hasTimeWindow = Boolean(action?.daily_limit && hasDailyTimeWindow(dailyWindow))
  const remainingSeconds = action && hasTimeWindow && inDailyWindow
    ? getDailyWindowRemainingSeconds(action, now)
    : null
  const showCountdown = remainingSeconds !== null
  const hasGroups = Boolean(action && action.groups.length > 0)
  const timer = remainingSeconds !== null ? formatRemainingAsTimer(remainingSeconds) : null
  const isUrgent = remainingSeconds !== null && remainingSeconds <= 15 * 60

  const colonDimmed = !reducedMotion && showCountdown && getIsraelSecond(now) % 2 === 1
  const colonStyle = { marginBottom: 4, opacity: colonDimmed ? 0.15 : 1 }
  const urgentLabelStyle = {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.5,
    color: isUrgent ? '#B82018' : '#B5623C',
    marginBottom: 4,
    opacity: isUrgent && colonDimmed ? 0.15 : 1,
  }
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
            {showCountdown ? (
              <span aria-hidden style={{ fontSize: 64, lineHeight: 1 }}>⏳</span>
            ) : (
              <span aria-hidden>🎯</span>
            )}
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
            <ShimmerText text={action?.name ?? '---'} />
          </div>
        </div>

        {showCountdown && timer && (
          <div style={{ marginTop: 10, width: '100%' }}>
            <div style={urgentLabelStyle}>
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
              {timer.showHours && (
                <>
                  <span>{timer.hours}</span>
                  <span style={colonStyle}>:</span>
                </>
              )}
              <span>{timer.minutes}</span>
              <span style={colonStyle}>:</span>
              <span>{timer.seconds}</span>
            </div>
          </div>
        )}
      </div>

      {swapRole !== 'out' && (
        <FloatingPointsBadge
          action={action}
          reducedMotion={reducedMotion}
          swapPhase={pointsSwapPhase}
        />
      )}
    </div>
  )
}


// ─── Main kiosk display ───────────────────────────────────────────────────────

function KioskDisplay({ event, data, gameStarted }: { event: Event; data: KioskData; gameStarted: boolean }) {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()

  const {
    recentActivity, rewards, topPrizes, allClaimablePrizes, prizeChaseParticipants, prizeAwardedPairs,
    configuredRewardsCount, newestRewardId,
    stats, actions, kioskParticipants, actionCompletionIndex, refetch, holdPrizeReveal,
  } = data
  const hasActivity = recentActivity.length > 0
  const hasAwardedRewards = rewards.length > 0
  const hasConfiguredRewards = configuredRewardsCount > 0

  // Recommended mission - prioritises time-window tasks while they are active
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const t = setInterval(tick, 1_000)
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

  const manualEntryAvailability = useMemo<ManualEntryAvailability>(() => ({
    actions: actions.map((action) => ({
      id: action.id,
      is_active: true,
      max_completions: action.max_completions,
      daily_limit: action.daily_limit,
      daily_start_hour: action.daily_start_hour,
      daily_start_minute: action.daily_start_minute,
      daily_end_hour: action.daily_end_hour,
      daily_end_minute: action.daily_end_minute,
      allowedGroupIds: action.groups.map((group) => group.id),
    })),
    participants: kioskParticipants,
    completionIndex: actionCompletionIndex,
  }), [actions, kioskParticipants, actionCompletionIndex])

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
    if (rotatableActions.length <= 1) return
    const t = setInterval(() => setRecommendedIdx(i => (i + 1) % rotatableActions.length), MISSION_ROTATE_MS)
    return () => clearInterval(t)
  }, [rotatableActions.length])
  const recommendedAction = rotatableActions[recommendedIdx] ?? null

  // Scanner access by activation mode:
  //   • free (trial) → live QR with server-enforced 5-scan trial quota
  //   • independent → no scanner; manual entry only
  //   • full / organizations → live QR scanner
  const { canScanQR, showLockedScanner } = usePlanPermissions(event.plan)
  const scanningLocked = showLockedScanner
  const manualOnly = !canScanQR && !showLockedScanner
  const noScan = scanningLocked || manualOnly
  const isTrial = event.plan === 'free'
  const { submit, submitting } = useScoreSubmit(event.id)
  const catalog = useEventCatalog(event.id)
  const [scanResult, setScanResult] = useState<ScanResultDisplay | null>(null)
  const [rewardWin, setRewardWin] = useState<RewardWinDisplay | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [trialLimitOpen, setTrialLimitOpen] = useState(false)
  const [toast, setToast] = useState<{ text: string; icon: string } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const scanDismissTimer = useRef<ReturnType<typeof setTimeout>>()
  const rewardDismissTimer = useRef<ReturnType<typeof setTimeout>>()
  const rewardQueueRef = useRef<RewardWinDisplay[]>([])
  const pendingWinsRef = useRef<{ wins: RewardWinDisplay[]; reducedMotion: boolean } | null>(null)

  // Clean up timers on unmount
  useEffect(() => () => {
    clearTimeout(toastTimerRef.current)
    clearTimeout(scanDismissTimer.current)
    clearTimeout(rewardDismissTimer.current)
    stopRewardFanfare()
  }, [])

  // Fetch the win fanfare while the screen is idle, so the first prize of the
  // day fires instantly instead of waiting on the download.
  useEffect(() => { primeRewardFanfare() }, [])

  useEffect(() => {
    if (gameStarted) return
    clearTimeout(scanDismissTimer.current)
    clearTimeout(rewardDismissTimer.current)
    stopRewardFanfare()
    rewardQueueRef.current = []
    pendingWinsRef.current = null
    setScanResult(null)
    setRewardWin(null)
    setShowManual(false)
    // No celebration is coming to release it.
    holdPrizeReveal(false)
  }, [gameStarted, holdPrizeReveal])

  const showToast = useCallback((msg: string, opts?: { icon?: string; ms?: number }) => {
    clearTimeout(toastTimerRef.current)
    setToast({ text: msg, icon: opts?.icon ?? '⚠️' })
    toastTimerRef.current = setTimeout(() => setToast(null), opts?.ms ?? 4000)
  }, [])

  // A scan landing while a popup is up would yank the card away from the
  // participant standing there - the operator gets a nudge instead.
  const popupBusy = scanResult !== null || rewardWin !== null
  const popupBusyRef = useRef(false)
  popupBusyRef.current = popupBusy

  const rejectScanWhileBusy = useCallback(() => {
    showToast('חכה שהסריקה הקודמת תסתיים', { icon: '⏳', ms: 2400 })
  }, [showToast])

  // Pops the next queued celebration or clears the overlay
  const showNextReward = useCallback(() => {
    clearTimeout(rewardDismissTimer.current)
    const next = rewardQueueRef.current.shift()
    // Last celebration closed - cut the fanfare if it is somehow still running.
    if (!next) { stopRewardFanfare(); setRewardWin(null); return }
    // The takeover now covers the banners, so the win may land in the feed.
    holdPrizeReveal(false)
    setRewardWin(next)
    rewardDismissTimer.current = setTimeout(() => showNextReward(), 6200)
  }, [holdPrizeReveal])

  // Closes the scan card and hands over to the prize celebration it queued.
  // Runs both on the timer and when the operator taps the card away, so a
  // pending win is never dropped - and the banner hold is always released.
  const finishScanCard = useCallback(() => {
    clearTimeout(scanDismissTimer.current)
    setScanResult(null)
    const pending = pendingWinsRef.current
    pendingWinsRef.current = null
    if (pending && pending.wins.length > 0) {
      if (!pending.reducedMotion) playRewardFanfare()
      rewardQueueRef.current.push(...pending.wins)
      showNextReward()
    } else {
      holdPrizeReveal(false)
    }
    refetch()
  }, [showNextReward, refetch, holdPrizeReveal])

  const triggerScanSuccess = useCallback((result: ScoreSubmitResult, _txId: string, rm: boolean) => {
    // Short confirmation blip the instant the scan validates - independent of the
    // reward chime below and of reduced-motion (this is a functional audio cue).
    playScanSuccess()
    clearTimeout(scanDismissTimer.current)
    clearTimeout(rewardDismissTimer.current)
    const { celebrationRewards } = result
    // A win must not surface in the rewards banner while the scan card is still
    // up - the prize takeover reveals it first, and releases the hold. Nothing
    // won here means nothing to protect, so the banners resume at once.
    if (celebrationRewards.length === 0) holdPrizeReveal(false)
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
    pendingWinsRef.current = {
      reducedMotion: rm,
      wins: celebrationRewards.map(rw => {
        const { icon } = rewardTier(rw.out_required_points)
        return { emoji: icon, title: rw.out_reward_name, sub: result.participantName, points: rw.out_required_points }
      }),
    }
    if (celebrationRewards.length > 0) {
      trackPrizeRevealed(celebrationRewards.length)
    }
    scanDismissTimer.current = setTimeout(finishScanCard, SCAN_SUCCESS_MS)
  }, [finishScanCard, refetch, holdPrizeReveal])

  const logScoreSubmit = useCallback((source: 'qr_scan' | 'manual_entry', result: ScoreSubmitResult) => {
    // Dev only - this prints participant name and code, which should not land in
    // an operator's browser console on a shared kiosk machine.
    if (!import.meta.env.DEV) return
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

  // The prize half of the banners freezes from the moment a scan is sent: the
  // reward row (and its realtime echo) can land before we know whether this scan
  // won anything, and a win belongs to the celebration first. Released here on
  // failure, in triggerScanSuccess when nothing was won, and by the celebration.
  const submitScan = useCallback(async (participantCode: string, actionCode: string) => {
    holdPrizeReveal(true)
    const response = await submit(participantCode, actionCode)
    if (!response.ok) holdPrizeReveal(false)
    return response
  }, [submit, holdPrizeReveal])

  const handleTrialLimit = useCallback(() => {
    trackTrialScanLimitReached(event.id, TRIAL_SCAN_LIMIT)
    trackScanFailed('trial_scan_limit', 'qr_scan')
    setTrialLimitOpen(true)
  }, [event.id])

  const handlePair = useCallback(async (participantCode: string, actionCode: string) => {
    if (!gameStarted) {
      trackScanFailed('not_started', 'qr_scan')
      showToast('התחרות עדיין לא התחילה')
      return
    }
    const response = await submitScan(participantCode, actionCode)
    if (!response.ok) {
      if (response.code === 'TRIAL_SCAN_LIMIT_REACHED') {
        handleTrialLimit()
        return
      }
      trackScanFailed('submit_failed', 'qr_scan')
      showToast(response.error)
      return
    }
    trackScanSuccess('qr_scan')
    if (isTrial) {
      trackTrialScanCompleted(event.id, response.result.eventScanCount)
    }
    logScoreSubmit('qr_scan', response.result)
    triggerScanSuccess(response.result, response.result.transactionId, reducedMotion)
  }, [gameStarted, submitScan, showToast, logScoreSubmit, triggerScanSuccess, reducedMotion, handleTrialLimit, isTrial, event.id])

  const handleScanError = useCallback((message: string) => {
    trackScanFailed('invalid_qr', 'qr_scan')
    showToast(message)
  }, [showToast])

  const {
    handleScan,
    pending: pendingScan,
    remainingSeconds,
    waitProgress,
    reset: resetScanSequence,
  } = useScanSequence({ onPair: handlePair, onError: handleScanError })

  // Swallow reads while the scan card or a prize celebration owns the screen,
  // so the running sequence is never cut short by the next participant.
  const handleScanGuarded = useCallback((raw: string) => {
    if (popupBusyRef.current) {
      rejectScanWhileBusy()
      return
    }
    handleScan(raw)
  }, [handleScan, rejectScanWhileBusy])

  // Greet the waiting participant by name. Unknown codes still arm - the code
  // is only validated on submit - so this stays null and the copy falls back.
  const pendingParticipantName = useMemo(() => {
    if (!pendingScan) return null
    const match = catalog.participants.find((p) => p.externalId === pendingScan.participantCode)
    return match?.name ?? null
  }, [pendingScan, catalog.participants])

  // Switching to manual entry (or hitting the trial wall) abandons the flow -
  // an armed participant must not survive to pair with a later action scan.
  useEffect(() => {
    if (showManual || trialLimitOpen) resetScanSequence()
  }, [showManual, trialLimitOpen, resetScanSequence])

  const bind = useHardwareScanner(gameStarted && !showManual && !submitting && !noScan && !trialLimitOpen, handleScanGuarded)

  const handleManualSubmit = useCallback(async (participantCode: string, actionCode: string) => {
    if (!gameStarted) {
      trackScanFailed('not_started', 'manual_entry')
      showToast('התחרות עדיין לא התחילה')
      return
    }
    // Same rule as the scanner - one participant on screen at a time.
    if (popupBusyRef.current) {
      rejectScanWhileBusy()
      return
    }
    const response = await submitScan(participantCode, actionCode)
    if (!response.ok) {
      if (response.code === 'TRIAL_SCAN_LIMIT_REACHED') {
        trackTrialScanLimitReached(event.id, TRIAL_SCAN_LIMIT)
        trackScanFailed('trial_scan_limit', 'manual_entry')
        setShowManual(false)
        setTrialLimitOpen(true)
        return
      }
      trackScanFailed('submit_failed', 'manual_entry')
      showToast(response.error)
      return
    }
    trackScanSuccess('manual_entry')
    if (isTrial) {
      trackTrialScanCompleted(event.id, response.result.eventScanCount)
    }
    logScoreSubmit('manual_entry', response.result)
    setShowManual(false)
    triggerScanSuccess(response.result, response.result.transactionId, reducedMotion)
  }, [gameStarted, submitScan, showToast, rejectScanWhileBusy, logScoreSubmit, triggerScanSuccess, reducedMotion, isTrial, event.id])

  return (
    <div style={{
      width: '100%', maxWidth: '100%', height: '100%', overflow: 'clip', position: 'relative',
      direction: 'rtl', color: '#2E221E',
      backgroundColor: '#FFF8F3',
      backgroundImage: [
        'radial-gradient(ellipse 60% 50% at 88% -10%,rgba(255,138,77,0.14),transparent 55%)',
        'radial-gradient(ellipse 55% 45% at 8% -6%,rgba(242,179,60,0.14),transparent 58%)',
        'radial-gradient(ellipse 55% 50% at 50% 122%,rgba(255,147,102,0.10),transparent 60%)',
      ].join(','),
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Hidden scanner input - captures hardware scanner keystrokes */}
      <input ref={bind} className="sr-only" aria-hidden="true" tabIndex={-1} />

      {/* Animated gradient backdrop */}
      <div className="kiosk-gradientShift" style={{
        position: 'absolute', inset: '-25%', zIndex: 0, pointerEvents: 'none', opacity: 0.75,
        background: 'linear-gradient(120deg,#FFE7D3,#FFF3DD,#E4F4F0,#FFEAD6,#FCEEDD,#FFE7D3)',
        backgroundSize: '320% 320%',
      }} />

      {/* Festive top strip - full bleed */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
        height: 6, background: 'linear-gradient(90deg,#FF9366,#FFB84D,#FFD68A,#8FCFA0,#5FB3AA)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column',
        minHeight: 0, boxSizing: 'border-box',
        paddingInline: 'clamp(12px, 1.2vw, 24px)',
        // Extra top clearance so the fixed ScreenControls toolbar (top-right)
        // never overlaps the missions panel - pushes all content a bit lower.
        paddingTop: 'calc(6px + clamp(12px, 1.2vw, 24px) + clamp(24px, 3vh, 40px))',
        paddingBottom: 'clamp(20px, 2.8vh, 36px)',
      }}>

      {/* Body - overflow visible so mission/prize icons can hang outside side banners */}
      <div style={{
        position: 'relative', zIndex: 1, flex: 1, display: 'flex',
        gap: 'clamp(10px, 1.0vw, 20px)',
        minHeight: 0, minWidth: 0, width: '100%', maxWidth: '100%',
        overflow: 'visible', contain: 'layout',
      }}>

        {/* RIGHT PANEL - orange:
            clip bottom like rewards; allow mission icons to hang on top/sides */}
        <div
          data-kiosk-panel="missions"
          className="kiosk-fadeUp"
          style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          flex: '1 1 0', minHeight: 0, minWidth: 0, borderRadius: 24,
          padding: '8px 18px 22px',
          background: 'linear-gradient(165deg,#FF9E6B,#EF8A4E)',
          boxShadow: '0 14px 32px rgba(239,138,78,0.3)',
          position: 'relative', overflow: 'visible', zIndex: 2,
          clipPath: 'inset(-56px -56px 0 -56px round 24px)',
        }}>
          <GlowingStarsOrange />

          {/* Recommended / active mission hero - tight to banner top; icons hang via overflow */}
          <div style={{
            marginBottom: 20,
            position: 'relative',
            zIndex: 20,
            overflow: 'visible',
            paddingTop: 12,
            paddingBottom: 16,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}>
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
          <div style={{ display: gameStarted ? 'block' : 'none', flex: 1, minHeight: 0, position: 'relative', zIndex: 1, overflow: 'hidden', paddingBottom: 4 }}>
            <ActivityView rows={recentActivity} active={true} reducedMotion={reducedMotion} />
          </div>
        </div>

        {/* CENTER - Scanner */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1.57 1 0', minHeight: 0, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
          {/* Confetti dots */}
          <div className="kiosk-floatY-1" style={{ position: 'absolute', top: 40, right: 80, width: 16, height: 16, borderRadius: 5, background: '#F2B33C' }} />
          <div className="kiosk-floatY-2" style={{ position: 'absolute', top: 100, left: 70, width: 14, height: 14, borderRadius: '50%', background: '#5FB3AA' }} />
          <div className="kiosk-floatY-3" style={{ position: 'absolute', top: 180, right: 40, width: 13, height: 13, borderRadius: '50%', background: '#FF9366' }} />
          <div className="kiosk-floatY-1" style={{ position: 'absolute', bottom: 150, right: 110, width: 12, height: 12, borderRadius: '50%', background: '#FFB84D' }} />
          <div className="kiosk-floatY-4" style={{ position: 'absolute', bottom: 90, left: 100, width: 18, height: 18, borderRadius: 6, background: '#8FCFA0' }} />
          <div className="kiosk-floatY-2" style={{ position: 'absolute', bottom: 200, left: 50, width: 12, height: 12, borderRadius: 5, background: '#FFCB9A' }} />

          <div className="kiosk-centerStack" style={{ gap: KIOSK_CENTER_GAP }}>
            <EventBrandMark event={event} onLogoClick={() => navigate(`/events/${event.id}/control`)} />

            {/* Headlines */}
            {!gameStarted && (
              <div style={{ textAlign: 'center', maxWidth: 620, flexShrink: 0 }}>
                <div style={{ fontSize: 42, fontWeight: 900, color: '#FF8A3D' }}>מוכנים לשחק?</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#7D706A', marginTop: 10, lineHeight: 1.5 }}>
                  הלוח, המשימות והפרסים יופיעו ברגע שהתחרות תתחיל.
                </div>
                <div className="kiosk-arrowBounce" style={{ marginTop: 14, fontSize: 24, fontWeight: 900, color: '#3E8F88' }}>
                  {noScan ? '👇 הזינו את המשתתף הראשון כדי להתחיל' : '👇 סרקו כאן כדי להתחיל'}
                </div>
              </div>
            )}

            {gameStarted && !hasActivity && (
              <div style={{ textAlign: 'center', maxWidth: 620, flexShrink: 0 }}>
                <div style={{ fontSize: 40, fontWeight: 900, color: '#FF8A3D' }}>🎉 הכול מוכן לרגע הגדול</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#7D706A', lineHeight: 1.45 }}>
                  {noScan
                    ? 'הזינו את המשתתף הראשון ותנו לתחרות להמריא!'
                    : 'סרקו את הכרטיס הראשון ותנו לתחרות להתחיל!'}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#3E8F88', lineHeight: 1.45 }}>
                  {noScan ? 'ההזנה הראשונה היא רק ההתחלה...' : 'הסריקה הראשונה היא רק ההתחלה...'}
                </div>
              </div>
            )}

            {gameStarted && hasActivity && (
              <div style={{ textAlign: 'center', maxWidth: 620, flexShrink: 0 }}>
                <div className="kiosk-scanWinHeadline" style={{ fontSize: 40, fontWeight: 900 }}>
                  <span className="kiosk-scanWinWord" style={{ color: '#FF8A3D', animationDelay: '0s' }}>{noScan ? 'שחקו' : 'סרקו'}</span>
                  <span className="kiosk-scanWinWord" style={{ color: '#F2A03C', animationDelay: '0.35s' }}>וזכו</span>
                  <span className="kiosk-scanWinWord" style={{ color: '#E8A93C', animationDelay: '0.7s' }}>בנקודות!</span>
                  <span className="kiosk-scanWinWord" style={{ animationDelay: '1.05s' }}>🎯</span>
                </div>
                <div className="kiosk-scanWinSubtitle" style={{ fontSize: 18, fontWeight: 700, color: '#7D706A' }}>
                  {stats.totalGroups > 0
                    ? 'כל משימה שתשלימו מקרבת את הקבוצה שלכם לנצחון'
                    : 'כל משימה שתשלימו מקרבת אתכם לנצחון'}
                </div>
              </div>
            )}

            {manualOnly ? (
              <div className="kiosk-scannerSlot">
                <KioskManualEntryPanel
                  eventId={event.id}
                  submitting={submitting}
                  onSubmit={handleManualSubmit}
                  catalog={catalog}
                  availability={manualEntryAvailability}
                  gameStarted={gameStarted}
                />
              </div>
            ) : (
              <>
                <div className="kiosk-scannerSlot">
                  <ScannerFrame
                    processing={gameStarted && submitting}
                    locked={scanningLocked}
                    awaiting={!!pendingScan}
                    awaitingName={pendingParticipantName}
                    awaitingSeconds={remainingSeconds}
                    waitProgress={waitProgress}
                  />
                </div>

                <div className="kiosk-centerHints">
                  {scanningLocked ? (
                    gameStarted ? (
                      <button
                        onClick={() => setShowManual(true)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          fontSize: 18, fontWeight: 900, color: '#fff',
                          background: 'linear-gradient(135deg,#FF9366,#F2B33C)',
                          border: 'none', cursor: 'pointer',
                          padding: '14px 32px', borderRadius: 999,
                          boxShadow: '0 8px 22px rgba(255,147,102,0.42)',
                        }}>
                        ⌨️ הזנה ידנית - שחקן · משימה
                      </button>
                    ) : (
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#7D706A', marginTop: 8 }}>
                        התחרות מתחילה ברגע שההזנה הידנית הראשונה תתבצע 🚀
                      </div>
                    )
                  ) : (
                    <>
                      {gameStarted && (
                        <button
                          onClick={() => setShowManual(true)}
                          style={{
                            display: 'inline',
                            fontSize: 15, fontWeight: 800, color: '#3E8F88',
                            textDecoration: 'underline', textUnderlineOffset: 3,
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          }}>
                          או בחרו הזנה ידנית - שחקן · משימה
                        </button>
                      )}
                      {!gameStarted && (
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#7D706A', marginTop: 8 }}>
                          התחרות מתחילה ברגע שהמשתתף הראשון סורק 🚀
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Scan-success overlay - covers center column */}
          <ScanSuccessOverlay
            result={scanResult}
            onDismiss={finishScanCard}
            reducedMotion={reducedMotion}
          />
        </div>

        {/* LEFT PANEL - teal / rewards:
            clip-path clips the bottom (like orange activity) while allowing
            trophy/badges to hang outside on top and sides */}
        <div
          data-kiosk-panel="rewards"
          className="kiosk-fadeUp"
          style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          flex: '1 1 0', minHeight: 0, minWidth: 0, borderRadius: 24,
          padding: '8px 18px 22px',
          background: 'linear-gradient(165deg,#5AB5AD,#388882)',
          boxShadow: '0 14px 32px rgba(46,120,112,0.32)',
          position: 'relative', overflow: 'visible', zIndex: 2,
          clipPath: 'inset(-56px -56px 0 -56px round 24px)',
        }}>
          <GlowingStarsTeal />

          {/* Prize hero - chase cards + rotating prize (2/3 of panel height) */}
          {hasConfiguredRewards && topPrizes.length > 0 && (
            <div style={{
              position: 'relative', zIndex: 3, flex: '2 1 0', minHeight: 0, minWidth: 0,
              overflow: 'visible',
            }}>
              <TopPrizes
                prizes={topPrizes}
                allClaimablePrizes={allClaimablePrizes}
                chaseParticipants={prizeChaseParticipants}
                awardedPairs={prizeAwardedPairs}
                gameStarted={gameStarted}
                reducedMotion={reducedMotion}
              />
            </div>
          )}

          {/* Awarded rewards feed - clip at banner bottom like orange activity list */}
          <div style={{
            position: 'relative', zIndex: 1, flex: '1 1 0', minHeight: 0,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', paddingBottom: 4,
          }}>
            {!hasConfiguredRewards ? (
              <RewardsNotConfiguredState onCreate={() => navigate(`/events/${event.id}/step/5`)} />
            ) : hasAwardedRewards ? (
              <AwardedRewardsFeed rewards={rewards} newestId={newestRewardId} now={now} />
            ) : gameStarted && hasActivity ? (
              <RewardsActiveNoAwardsFeed />
            ) : gameStarted ? (
              <RewardsStartedEmptyFeed />
            ) : (
              <RewardsPreGameFeed />
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Reward celebration - full-screen takeover, z-index 40 */}
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
              availability={manualEntryAvailability}
            />
          </div>
        </div>
      )}

      {/* Error / nudge toast - above every popup, so it reads mid-celebration */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, background: '#2E221E', color: '#fff',
          padding: '12px 24px', borderRadius: 14,
          fontWeight: 800, fontSize: 15,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          {toast.icon} {toast.text}
        </div>
      )}

      <TrialScanLimitModal
        isOpen={trialLimitOpen}
        onClose={() => setTrialLimitOpen(false)}
        eventId={event.id}
      />
    </div>
  )
}

// ─── Viewport wrapper ─────────────────────────────────────────────────────────
function lockKioskViewportScroll() {
  const html = document.documentElement
  const body = document.body
  html.style.overflow = 'clip'
  html.style.overflowX = 'clip'
  html.style.overflowY = 'clip'
  html.style.scrollbarGutter = 'auto'
  body.style.overflow = 'clip'
  body.style.overflowX = 'clip'
  body.style.overflowY = 'clip'
  body.style.scrollbarGutter = 'auto'
  body.style.margin = '0'
  html.scrollLeft = 0
  body.scrollLeft = 0
  window.scrollTo(0, 0)
}

function KioskViewport({ event, data, gameStarted }: { event: Event; data: KioskData; gameStarted: boolean }) {
  useLayoutEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevHtmlOverflowX = html.style.overflowX
    const prevHtmlOverflowY = html.style.overflowY
    const prevHtmlScrollbarGutter = html.style.scrollbarGutter
    const prevBodyOverflow = body.style.overflow
    const prevBodyOverflowX = body.style.overflowX
    const prevBodyOverflowY = body.style.overflowY
    const prevBodyScrollbarGutter = body.style.scrollbarGutter
    const prevBodyMargin = body.style.margin
    const sync = () => lockKioskViewportScroll()
    sync()
    requestAnimationFrame(sync)
    requestAnimationFrame(() => requestAnimationFrame(sync))
    const onResize = () => sync()
    const onScroll = () => {
      if (html.scrollLeft || body.scrollLeft || window.scrollX) {
        html.scrollLeft = 0
        body.scrollLeft = 0
        window.scrollTo(0, window.scrollY)
      }
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      html.style.overflow = prevHtmlOverflow
      html.style.overflowX = prevHtmlOverflowX
      html.style.overflowY = prevHtmlOverflowY
      html.style.scrollbarGutter = prevHtmlScrollbarGutter
      body.style.overflow = prevBodyOverflow
      body.style.overflowX = prevBodyOverflowX
      body.style.overflowY = prevBodyOverflowY
      body.style.scrollbarGutter = prevBodyScrollbarGutter
      body.style.margin = prevBodyMargin
    }
  }, [])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      overflow: 'clip', overscrollBehavior: 'none', background: '#FFF8F3',
    }}>
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
    if (!event) return
    trackScannerView(event.plan)
  }, [event])

  useEffect(() => {
    if (!event || !data.error || data.loading) return
    trackAppError('scanner', 'load_failed')
  }, [event, data.error, data.loading])

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
      <div style={{ width: '100%', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF8F3', direction: 'rtl' }}>
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

  return (
    <>
      <ScreenControls to={`/events/${event.id}/control`} soundScope="scan" />
      <KioskViewport event={event} data={data} gameStarted={gameStarted} />
    </>
  )
}
