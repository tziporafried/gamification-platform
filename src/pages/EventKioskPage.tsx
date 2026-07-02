import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { useRotatingView } from '@/hooks/useRotatingView'
import { computeRanks } from '@/lib/missionUtils'
import { ManualEntryForm } from '@/components/ops/ManualEntryForm'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import { useScoreSubmit } from '@/hooks/useScoreSubmit'
import { useEventCatalog } from '@/hooks/useEventCatalog'
import { parseQrPayload } from '@/lib/qrPayload'
import { hexToRgb } from '@/lib/accentColor'
import type { Event, GroupLeaderboardEntry, ParticipantLeaderboardEntry } from '@/types'
import type { ScoreSubmitResult } from '@/hooks/useScoreSubmit'
import '@/styles/kiosk.css'

const KIOSK_ACCENT = hexToRgb('#AB3500') ?? { r: 171, g: 53, b: 0 }
const ACTIVITY_ACCENTS = ['#FF8A4D', '#4FA6A0', '#F2B33C']

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
type ActivityRow = { id: string; icon: string; title: string; subtitle: string; points: string; accent: string }
type RewardRow = { id: string; icon: string; title: string; recipient: string; score: number; accent: string }
type KioskAction = { id: string; name: string; points: number }
type ScanResultDisplay = { name: string; action: string; initial: string; emoji: string; points: number; tone: string }
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
  actions: KioskAction[]
  stats: KioskStats
  totalScans: number
  loading: boolean
  error: boolean
  refetch: () => void
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
function useKioskData(eventId: string): KioskData {
  const [groupData, setGroupData] = useState<GroupLeaderboardEntry[]>([])
  const [participantData, setParticipantData] = useState<ParticipantLeaderboardEntry[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [txData, setTxData] = useState<any[]>([])
  const [txCount, setTxCount] = useState(0)
  const [actionsData, setActionsData] = useState<KioskAction[]>([])
  const [rewardsData, setRewardsData] = useState<RewardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!eventId) return
    try {
      const [gRes, pRes, txRes, countRes, actRes, rwRes] = await Promise.all([
        supabase.rpc('get_group_leaderboard', { p_event_id: eventId }),
        supabase.rpc('get_participant_leaderboard', { p_event_id: eventId }),
        supabase
          .from('point_transactions')
          .select('id, points, created_at, participant:participants(name), action:actions(name, code)')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('point_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId),
        supabase
          .from('actions')
          .select('id, name, points')
          .eq('event_id', eventId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('participant_rewards')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .select('id, awarded_at, reward:rewards(name, required_points), participant:participants(name)' as any)
          .eq('event_id', eventId)
          .order('awarded_at', { ascending: false })
          .limit(3),
      ])

      if (gRes.error && pRes.error) { setError(true); return }
      setError(false)

      if (gRes.data) setGroupData(gRes.data as GroupLeaderboardEntry[])
      if (pRes.data) setParticipantData(pRes.data as ParticipantLeaderboardEntry[])
      if (txRes.data) setTxData(txRes.data as unknown as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      setTxCount(countRes.count ?? 0)

      if (actRes.data) {
        setActionsData(actRes.data.map(a => ({ id: a.id, name: a.name, points: a.points })))
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
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    const t = setInterval(fetchAll, 30_000)
    return () => clearInterval(t)
  }, [fetchAll])

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
    txData.slice(0, 3).map((tx: any, i: number) => {
      const action = Array.isArray(tx.action) ? tx.action[0] : tx.action
      const participant = Array.isArray(tx.participant) ? tx.participant[0] : tx.participant
      return {
        id: tx.id,
        icon: '🎯',
        title: action?.name ?? 'משימה',
        subtitle: participant?.name ?? '',
        points: tx.points > 0 ? `+${tx.points}` : String(tx.points),
        accent: ACTIVITY_ACCENTS[i % ACTIVITY_ACCENTS.length],
      }
    })
  , [txData])

  const stats = useMemo<KioskStats>(() => ({
    totalMissions: txCount,
    totalPoints: groupData.reduce((s, g) => s + g.total_points, 0),
    totalGroups: groupData.length,
  }), [txCount, groupData])

  return {
    rankedGroups, topPlayers, recentActivity, rewards: rewardsData,
    actions: actionsData, stats, totalScans: txCount,
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
            <div style={{ position: 'absolute', bottom: -4, right: -4, fontSize: 20 }}>{result.emoji}</div>
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

function ChampionCard({ row, medalEmoji }: { row: RankRow; medalEmoji: string }) {
  const avatarGrad = 'linear-gradient(135deg,#FF8A4D,#F26A2E)'
  return (
    <div className="kiosk-fadeUp kiosk-cardBreathe" style={{
      position: 'relative', borderRadius: 22, overflow: 'hidden',
      background: 'linear-gradient(135deg,#FFFDF7,#FFF1D2)',
      border: '2px solid #F2B33C',
      boxShadow: '0 12px 28px rgba(242,140,20,0.4), 0 0 0 4px rgba(255,255,255,0.4)',
    }}>
      <div className="kiosk-pulseGlow" style={{ position: 'absolute', top: -46, left: -34, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,196,74,0.5),transparent 70%)' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px' }}>
        <div style={{ position: 'relative', flex: '0 0 auto' }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', background: avatarGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: '#fff', boxShadow: '0 5px 14px rgba(242,106,46,0.5)' }}>
            {row.initial}
          </div>
          <div className="kiosk-crownPop" style={{ position: 'absolute', bottom: -5, left: -5, width: 26, height: 26, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 2px 7px rgba(0,0,0,0.25)' }}>
            {medalEmoji}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: 20, color: '#2E221E' }}>{row.name}</span>
            <span style={{ background: '#F2B33C', color: '#fff', fontWeight: 900, fontSize: 11, padding: '2px 9px', borderRadius: 999 }}>👑 מוביל/ת</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 1 }}>
            <span className="kiosk-numberGlow" style={{ fontWeight: 900, fontSize: 24, color: '#C8890B', display: 'inline-block' }}>{row.score.toLocaleString('he-IL')}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#B08A3C' }}>נק׳</span>
          </div>
          <div style={{ height: 9, borderRadius: 999, background: 'rgba(0,0,0,0.06)', marginTop: 7, overflow: 'hidden' }}>
            <div className="kiosk-raceGrow" style={{ height: '100%', width: `${row.barPct}%`, borderRadius: 999, background: 'linear-gradient(90deg,#F2B33C,#FF9366)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

const RANK_AVATAR_GRADS: Record<number, string> = {
  1: 'linear-gradient(135deg,#FF8A4D,#F26A2E)',
  2: 'linear-gradient(135deg,#5FB8B1,#3E8F88)',
  3: 'linear-gradient(135deg,#FBC552,#E09A1F)',
  4: 'linear-gradient(135deg,#7FCF98,#4C9E6E)',
}
const RANK_SCORE_COLORS: Record<number, string> = {
  1: '#C8890B', 2: '#3E8F88', 3: '#C8890B', 4: '#4C9E6E',
}
const RANK_BAR_COLORS: Record<number, string> = {
  1: '#F2B33C', 2: '#4FA6A0', 3: '#F2B33C', 4: '#62B584',
}
const RANK_SHADOW: Record<number, string> = {
  1: '0 7px 18px rgba(79,166,160,0.32)',
  2: '0 7px 18px rgba(79,166,160,0.32)',
  3: '0 7px 18px rgba(242,179,60,0.32)',
  4: '0 7px 18px rgba(98,181,132,0.32)',
}
const MEDALS = ['🥇', '🥈', '🥉']

function RankCard({ row, rank, delay }: { row: RankRow; rank: number; delay: string }) {
  const avatarGrad = RANK_AVATAR_GRADS[rank] || RANK_AVATAR_GRADS[4]
  const scoreColor = RANK_SCORE_COLORS[rank] || '#4C9E6E'
  const barColor = RANK_BAR_COLORS[rank] || '#62B584'

  return (
    <div className="kiosk-fadeUp" style={{
      animationDelay: delay,
      display: 'flex', alignItems: 'center', gap: 13, padding: '12px 15px',
      borderRadius: 20, background: '#FFFFFF', boxShadow: RANK_SHADOW[rank] || RANK_SHADOW[4],
    }}>
      <div style={{ position: 'relative', flex: '0 0 auto' }}>
        <div style={{
          width: 50, height: 50, borderRadius: '50%', background: avatarGrad,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 23, fontWeight: 900, color: '#fff',
        }}>
          {row.initial}
        </div>
        <div style={{
          position: 'absolute', bottom: -5, left: -5, width: 24, height: 24, borderRadius: '50%',
          background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: rank <= 3 ? 14 : 13, fontWeight: rank > 3 ? 900 : undefined,
          color: rank > 3 ? '#4C9E6E' : undefined,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}>
          {rank <= 3 ? MEDALS[rank - 1] : String(rank)}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 900, fontSize: 18 }}>{row.name}</span>
          <span style={{ fontWeight: 900, fontSize: 19, color: scoreColor }}>{row.score.toLocaleString('he-IL')}</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(0,0,0,0.06)', marginTop: 7, overflow: 'hidden' }}>
          <div className="kiosk-raceGrow" style={{ height: '100%', width: `${row.barPct}%`, borderRadius: 999, background: barColor }} />
        </div>
      </div>
    </div>
  )
}

function BattlePill({ text, delay }: { text: string; delay?: string }) {
  return (
    <div className="kiosk-fadeUp" style={{
      animationDelay: delay,
      alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8,
      background: 'linear-gradient(135deg,#FF8A3D,#FF7350)', color: '#fff',
      fontWeight: 900, fontSize: 15, padding: '9px 20px', borderRadius: 999,
      boxShadow: '0 6px 16px rgba(255,115,80,0.32)',
    }}>
      <span className="kiosk-fireFlicker" style={{ display: 'inline-block' }}>🔥</span>
      {text}
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

// ─── Right panel views ────────────────────────────────────────────────────────

function ActivityView({ rows, active }: { rows: ActivityRow[]; active: boolean }) {
  const style: React.CSSProperties = {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 9,
    transition: 'opacity 0.6s ease, transform 0.6s ease',
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0)' : 'translateY(-10px)',
    pointerEvents: active ? 'auto' : 'none',
  }
  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="kiosk-blink" style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFFFFF', display: 'inline-block' }} />
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '1.5px', color: '#FFFFFF' }}>פעילות אחרונה</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700, textAlign: 'center', paddingTop: 16 }}>אין פעילות עדיין</div>
      ) : rows.map(r => (
        <div key={r.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
          borderRadius: 16, background: '#fff', borderRight: `5px solid ${r.accent}`,
          boxShadow: '0 4px 12px rgba(120,50,10,0.14)',
        }}>
          <span style={{ fontSize: 24 }}>{r.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{r.title}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7D706A' }}>{r.subtitle}</div>
          </div>
          <span style={{ fontWeight: 900, fontSize: 17, color: '#4C9E6E' }}>{r.points}</span>
        </div>
      ))}
    </div>
  )
}

function RewardsView({ rewards, active }: { rewards: RewardRow[]; active: boolean }) {
  const style: React.CSSProperties = {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 9,
    transition: 'opacity 0.6s ease, transform 0.6s ease',
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0)' : 'translateY(10px)',
    pointerEvents: active ? 'auto' : 'none',
  }
  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="kiosk-blink" style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFFFFF', display: 'inline-block' }} />
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '1.5px', color: '#FFFFFF' }}>🎁 פרסים שחולקו</span>
      </div>
      {rewards.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700, textAlign: 'center', paddingTop: 16 }}>אין פרסים עדיין</div>
      ) : rewards.map(r => (
        <div key={r.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
          borderRadius: 16, background: '#fff', borderRight: `5px solid ${r.accent}`,
          boxShadow: '0 4px 12px rgba(120,50,10,0.14)',
        }}>
          <span style={{ fontSize: 26 }}>{r.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{r.title}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7D706A' }}>{r.recipient}</div>
          </div>
          <span style={{ fontWeight: 900, fontSize: 16, color: r.accent }}>{r.score.toLocaleString('he-IL')}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Left panel views ─────────────────────────────────────────────────────────

function GroupLeaderboardView({ rows, totalPoints, totalScans, active }: {
  rows: RankRow[]; totalPoints: number; totalScans: number; active: boolean
}) {
  const style: React.CSSProperties = {
    position: 'absolute', inset: 0, zIndex: 1, padding: 18,
    display: 'flex', flexDirection: 'column', gap: 11, boxSizing: 'border-box',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0)' : 'translateY(-10px)',
    pointerEvents: active ? 'auto' : 'none',
  }
  const champ = rows[0]
  const rest = rows.slice(1)
  const battleDiff = rows.length >= 2 ? rows[0].score - rows[1].score : null

  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF', textShadow: '0 1px 6px rgba(0,0,0,0.18)' }}>דירוג הקבוצות 🏆</div>
        <LivePill />
      </div>
      {rows.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: 700 }}>
          אין קבוצות עדיין
        </div>
      ) : (
        <>
          {champ && <ChampionCard row={champ} medalEmoji="🥇" />}
          {battleDiff !== null && battleDiff <= 50 && (
            <BattlePill text={`רק ${battleDiff} נקודות הפרש!`} delay="0.35s" />
          )}
          {rest.map((r, i) => (
            <RankCard key={r.id} row={r} rank={i + 2} delay={`${0.15 + i * 0.1}s`} />
          ))}
        </>
      )}
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 6, color: 'rgba(255,255,255,0.95)', fontWeight: 800, fontSize: 14, textShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
        🎉 {totalPoints.toLocaleString('he-IL')} נקודות חולקו · {totalScans} סריקות
      </div>
    </div>
  )
}

function TopPlayersView({ rows, totalScans, active }: {
  rows: RankRow[]; totalScans: number; active: boolean
}) {
  const style: React.CSSProperties = {
    position: 'absolute', inset: 0, zIndex: 1, padding: 18,
    display: 'flex', flexDirection: 'column', gap: 11, boxSizing: 'border-box',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0)' : 'translateY(10px)',
    pointerEvents: active ? 'auto' : 'none',
  }
  const champ = rows[0]
  const rest = rows.slice(1)

  return (
    <div style={style}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div className="kiosk-floatY-1" style={{ position: 'absolute', top: 66, left: 22, fontSize: 20 }}>✨</div>
        <div className="kiosk-floatY-2" style={{ position: 'absolute', top: 150, right: 26, fontSize: 17 }}>⭐</div>
        <div className="kiosk-floatY-3" style={{ position: 'absolute', bottom: 70, left: 30, fontSize: 18 }}>🎉</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF', textShadow: '0 1px 6px rgba(0,0,0,0.18)' }}>שחקנים מובילים 🏆</div>
        <LivePill />
      </div>
      {rows.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: 700, position: 'relative', zIndex: 1 }}>
          אין שחקנים עדיין
        </div>
      ) : (
        <>
          {champ && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <ChampionCard row={champ} medalEmoji="🥇" />
            </div>
          )}
          {champ && (
            <div style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#FF8A3D,#FF7350)', color: '#fff', fontWeight: 900, fontSize: 15, padding: '9px 20px', borderRadius: 999, boxShadow: '0 6px 16px rgba(255,115,80,0.32)', position: 'relative', zIndex: 1 }}>
              <span className="kiosk-fireFlicker" style={{ display: 'inline-block' }}>⭐</span>
              {champ.name} שובר/ת שיאים!
            </div>
          )}
          {rest.map((r, i) => (
            <div key={r.id} style={{ position: 'relative', zIndex: 1 }}>
              <RankCard row={r} rank={i + 2} delay={`${0.15 + i * 0.1}s`} />
            </div>
          ))}
        </>
      )}
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 6, color: 'rgba(255,255,255,0.95)', fontWeight: 800, fontSize: 14, textShadow: '0 1px 4px rgba(0,0,0,0.15)', position: 'relative', zIndex: 1 }}>
        🎉 {rows.length} שחקנים פעילים · {totalScans} סריקות
      </div>
    </div>
  )
}

// ─── Main kiosk display ───────────────────────────────────────────────────────

function KioskDisplay({ event, data }: { event: Event; data: KioskData }) {
  const view = useRotatingView(10000)
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()

  const { rankedGroups, topPlayers, recentActivity, rewards, stats, totalScans, actions } = data

  // Recommended mission — rotates every 30 s
  const [recommendedIdx, setRecommendedIdx] = useState(0)
  useEffect(() => {
    if (actions.length <= 1) return
    const t = setInterval(() => setRecommendedIdx(i => (i + 1) % actions.length), 30_000)
    return () => clearInterval(t)
  }, [actions.length])
  const recommendedAction = actions[recommendedIdx] ?? null

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

  // Clean up timers on unmount
  useEffect(() => () => {
    clearTimeout(toastTimerRef.current)
    clearTimeout(scanDismissTimer.current)
    clearTimeout(rewardDismissTimer.current)
  }, [])

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimerRef.current)
    setToastMsg(msg)
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 4000)
  }, [])

  const triggerScanSuccess = useCallback((result: ScoreSubmitResult, rm: boolean) => {
    clearTimeout(scanDismissTimer.current)
    clearTimeout(rewardDismissTimer.current)
    setScanResult({
      name: result.participantName,
      action: `השלים/ה · ${result.actionName}`,
      initial: result.participantName.charAt(0),
      emoji: '🎯',
      points: result.points,
      tone: '#EF8A4E',
    })
    const { celebrationRewards } = result
    scanDismissTimer.current = setTimeout(() => {
      setScanResult(null)
      if (celebrationRewards.length > 0) {
        const rw = celebrationRewards[0]
        const { icon } = rewardTier(rw.out_required_points)
        if (!rm) playSuccessChime()
        setRewardWin({ emoji: icon, title: rw.out_reward_name, sub: result.participantName, points: rw.out_required_points })
        rewardDismissTimer.current = setTimeout(() => setRewardWin(null), 6200)
      }
    }, 4200)
  }, [])

  const handleScan = useCallback(async (raw: string) => {
    const parsed = parseQrPayload(raw)
    if (!parsed.ok) { showToast('קוד QR לא תקין'); return }
    const result = await submit(parsed.data.participantCode, parsed.data.actionCode)
    if (!result) { showToast('שגיאה בשליחת הנקודות'); return }
    triggerScanSuccess(result, reducedMotion)
  }, [submit, showToast, triggerScanSuccess, reducedMotion])

  const bind = useHardwareScanner(!showManual && !submitting, handleScan)

  const handleManualSubmit = useCallback(async (participantCode: string, actionCode: string) => {
    const result = await submit(participantCode, actionCode)
    if (!result) { showToast('שגיאה בשליחת הנקודות'); return }
    setShowManual(false)
    triggerScanSuccess(result, reducedMotion)
  }, [submit, showToast, triggerScanSuccess, reducedMotion])

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
          background: 'rgba(98,181,132,0.14)', border: '1px solid rgba(98,181,132,0.4)',
          color: '#3F8A5E', padding: '8px 16px', borderRadius: 999, fontWeight: 800, fontSize: 14,
        }}>
          <span className="kiosk-blink" style={{ width: 10, height: 10, borderRadius: '50%', background: '#62B584', display: 'inline-block' }} />
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
          position: 'relative', overflow: 'hidden',
        }}>
          <GlowingStarsOrange />

          {/* Recommended mission hero card */}
          <div className="kiosk-fadeUp kiosk-cardBreathe" style={{
            position: 'relative', zIndex: 1, borderRadius: 22, padding: 20,
            background: '#FFFFFF', boxShadow: '0 10px 24px rgba(120,50,10,0.18)',
            overflow: 'hidden', color: '#2E221E', border: '1.5px solid #FFD8BC',
            animationDelay: '0.6s',
          }}>
            <div style={{ position: 'absolute', top: -30, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,147,102,0.1)' }} />
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              <div className="kiosk-shimmerSweep" style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
              <div className="kiosk-bob" style={{ fontSize: 52, lineHeight: 1 }}>🎯</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: '#E07A3E' }}>משימה מומלצת</div>
                <div style={{ fontSize: 26, fontWeight: 900, marginTop: 2 }}>
                  {recommendedAction?.name ?? (actions.length === 0 ? '---' : actions[0]?.name ?? '---')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14, position: 'relative' }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#E07A3E' }}>
                {recommendedAction
                  ? (recommendedAction.points > 0 ? `+${recommendedAction.points}` : String(recommendedAction.points))
                  : '---'}
              </span>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#7D706A' }}>נקודות לקבוצה</span>
            </div>
          </div>

          {/* Stat tiles */}
          <div style={{ display: 'flex', gap: 10, position: 'relative', zIndex: 1 }}>
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

          {/* Rotating activity / rewards */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1 }}>
            <ActivityView rows={recentActivity} active={view === 0} />
            <RewardsView rewards={rewards} active={view === 1} />
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

          <div style={{ textAlign: 'center' }}>
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

          <ScannerFrame processing={submitting} />

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#2E221E' }}>כוונו את כרטיס ה-QR של המשתתף למסגרת</div>
            <button
              onClick={() => setShowManual(true)}
              style={{
                fontSize: 15, fontWeight: 800, color: '#3E8F88', marginTop: 8,
                textDecoration: 'underline', textUnderlineOffset: 3,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
              או בחרו הזנה ידנית — שחקן · משימה
            </button>
          </div>

          {/* Scan-success overlay — covers center column */}
          <ScanSuccessOverlay
            result={scanResult}
            onDismiss={() => { clearTimeout(scanDismissTimer.current); setScanResult(null) }}
            reducedMotion={reducedMotion}
          />
        </div>

        {/* LEFT PANEL — teal */}
        <div className="kiosk-fadeUp" style={{
          flex: '0 0 clamp(300px, 27vw, 580px)', position: 'relative', overflow: 'hidden',
          borderRadius: 24, background: 'linear-gradient(165deg,#7CCBC3,#4FA6A0)',
          boxShadow: '0 14px 32px rgba(59,136,128,0.28)',
        }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.16) 1.5px,transparent 1.6px)', backgroundSize: '22px 22px', opacity: 0.55 }} />
          <div style={{ position: 'absolute', top: -70, right: -50, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,0.28),transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: -90, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,214,138,0.22),transparent 70%)' }} />
          <GlowingStarsTeal />

          <GroupLeaderboardView
            rows={rankedGroups}
            totalPoints={stats.totalPoints}
            totalScans={totalScans}
            active={view === 0}
          />
          <TopPlayersView
            rows={topPlayers}
            totalScans={totalScans}
            active={view === 1}
          />
        </div>
      </div>

      {/* View rotation indicator dots */}
      <div style={{ position: 'absolute', zIndex: 2, bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-block', height: 8, borderRadius: 999,
          background: view === 0 ? '#EF8A4E' : 'rgba(255,255,255,0.45)',
          width: view === 0 ? 28 : 10,
          transition: 'width 0.5s ease, background 0.5s ease',
          boxShadow: view === 0 ? '0 0 8px rgba(239,138,78,0.6)' : 'none',
        }} />
        <span style={{
          display: 'inline-block', height: 8, borderRadius: 999,
          background: view === 1 ? '#4FA6A0' : 'rgba(255,255,255,0.45)',
          width: view === 1 ? 28 : 10,
          transition: 'width 0.5s ease, background 0.5s ease',
          boxShadow: view === 1 ? '0 0 8px rgba(79,166,160,0.6)' : 'none',
        }} />
      </div>

      {/* Reward celebration — full-screen takeover, z-index 40 */}
      <RewardCelebration
        win={rewardWin}
        onDismiss={() => { clearTimeout(rewardDismissTimer.current); setRewardWin(null) }}
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
function KioskViewport({ event, data }: { event: Event; data: KioskData }) {
  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', background: '#FFF8F3' }}>
      <KioskDisplay event={event} data={data} />
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

  const data = useKioskData(id ?? '')

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

  return <KioskViewport event={event} data={data} />
}

