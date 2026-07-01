import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Trophy, RotateCcw, X, Crown, Users, ArrowUp, ArrowDown, ClipboardCheck, Award, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useSound } from '@/hooks/useSound'
import { SoundToggle } from './SoundToggle'
import { LeaderboardEmptyState } from './LeaderboardEmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { CenteredLoader } from '@/components/ui/CenteredLoader'
import { Spinner } from '@/components/ui/Spinner'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import type { ParticipantLeaderboardEntry, GroupLeaderboardEntry } from '@/types'

interface LeaderboardSectionProps { eventId: string; eventName?: string; eventLogoUrl?: string | null }
interface TxRow { id: string; participant_id: string; action_id: string; points: number; created_at: string; participant: { name: string; external_id: string }; action: { name: string; code: string } }
interface PgMapping { participant_id: string; groups: { id: string; name: string; color: string } | null }

function computeRanks<T extends { total_points: number }>(entries: T[]): (T & { rank: number })[] {
  let r = 1; return entries.map((e, i) => { if (i > 0 && e.total_points < entries[i - 1].total_points) r = i + 1; return { ...e, rank: r } })
}

const RANK_BG: Record<number, string> = { 1: 'var(--color-warning)', 2: 'var(--color-muted)', 3: 'var(--color-accent)' }
const RANK_GLOW: Record<number, string> = {
  1: '0 0 18px rgba(234,179,8,0.55), 0 0 4px rgba(234,179,8,0.3)',
  2: '0 0 14px rgba(161,161,170,0.35)',
  3: '0 0 14px rgba(234,88,12,0.4)',
}
const RANK_ROW_BG: Record<number, string> = {
  1: 'rgba(234,179,8,0.06)',
  2: 'rgba(161,161,170,0.04)',
  3: 'rgba(234,88,12,0.04)',
}
const CONFETTI_COLORS = ['var(--color-warning)', 'var(--color-accent)', 'var(--color-primary)', 'var(--color-primary-hover)', 'var(--color-secondary)', 'var(--color-success)', 'var(--color-danger)', 'var(--color-muted)']

type RevealPhase = 'loading' | 'suspense' | 'counting' | 'revealed' | 'complete'

function RankCircle({ rank }: { rank: number }) {
  const bg = RANK_BG[rank]
  return (
    <motion.div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-foreground shadow-lg"
      style={{ backgroundColor: bg || 'var(--color-border)', boxShadow: RANK_GLOW[rank] || 'none' }}
      animate={rank <= 3 ? { scale: [1, 1.08, 1] } : undefined}
      transition={rank <= 3 ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: rank * 0.3 } : undefined}>
      {rank}
    </motion.div>
  )
}

function AnimatedNumber({ value, duration = 1400 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (value === 0) { setDisplay(0); return }
    const start = performance.now()
    function tick(now: number) { const p = Math.min((now - start) / duration, 1); setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * value)); if (p < 1) raf.current = requestAnimationFrame(tick) }
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current)
  }, [value, duration])
  return <>{display.toLocaleString('he-IL')}</>
}

function DetailModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-foreground/40 backdrop-blur-md" onClick={onClose} />
        <motion.div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-card max-h-[85vh] overflow-y-auto"
          initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ duration: 0.25 }}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-black text-foreground">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition-all hover:bg-surface-elevated hover:text-foreground hover:scale-110"><X size={18} /></button>
          </div>{children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export function LeaderboardSection({ eventId, eventName, eventLogoUrl }: LeaderboardSectionProps) {
  const [participantData, setParticipantData] = useState<ParticipantLeaderboardEntry[]>([])
  const [groupData, setGroupData] = useState<GroupLeaderboardEntry[]>([])
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [pgMap, setPgMap] = useState<Map<string, { id: string; name: string; color: string }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [phase, setPhase] = useState<RevealPhase>('loading')
  const [showConfetti, setShowConfetti] = useState(false)
  const { play, playApplause, muted, toggleMute } = useSound()
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  const playRef = useRef(play)
  playRef.current = play
  const playApplauseRef = useRef(playApplause)
  playApplauseRef.current = playApplause

  const confettiPieces = useMemo(() => Array.from({ length: 60 }, () => ({
    left: `${Math.random() * 100}%`, delay: `${Math.random() * 1.8}s`,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 4 + Math.random() * 8, rotation: Math.random() * 360, isCircle: Math.random() > 0.5,
  })), [])

  const sparkles = useMemo(() => Array.from({ length: 12 }, () => ({
    left: 5 + Math.random() * 90, top: 5 + Math.random() * 90,
    duration: 1.5 + Math.random() * 2, delay: Math.random() * 3, size: 1.5 + Math.random() * 2.5,
  })), [])

  const fetchAll = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (!silent) {
      setError('')
      setLoading(true)
      setPhase('loading')
    }
    try {
      const [pRes, gRes, txRes] = await Promise.all([
        supabase.rpc('get_participant_leaderboard', { p_event_id: eventId }), supabase.rpc('get_group_leaderboard', { p_event_id: eventId }),
        supabase.from('point_transactions').select('id, participant_id, action_id, points, created_at, participant:participants(name, external_id), action:actions(name, code)').eq('event_id', eventId).order('created_at', { ascending: false }).limit(200),
      ])
      if (pRes.error || gRes.error) { setError('טבלת הדירוג בהכנה. אנא נסו שוב בקרוב.'); setLoading(false); return }
      const pData = (pRes.data ?? []) as ParticipantLeaderboardEntry[]; const gData = (gRes.data ?? []) as GroupLeaderboardEntry[]
      setParticipantData(pData); setGroupData(gData); setTransactions((txRes.data ?? []) as unknown as TxRow[])
      if (pData.length > 0) {
        const ids = pData.map((p) => p.participant_id); const allPg: PgMapping[] = []
        for (let i = 0; i < ids.length; i += 100) { const { data } = await supabase.from('participant_groups').select('participant_id, groups(id, name, color)').in('participant_id', ids.slice(i, i + 100)); if (data) allPg.push(...(data as unknown as PgMapping[])) }
        const map = new Map<string, { id: string; name: string; color: string }>(); for (const m of allPg) { if (m.groups) map.set(m.participant_id, m.groups) }; setPgMap(map)
      }
      setLoading(false)
      if (silent) return
      if (pData.length > 0) {
        setPhase('suspense')
        setTimeout(() => { setPhase('counting'); if (!mutedRef.current) playRef.current() }, 1500)
        setTimeout(() => { setPhase('revealed'); setShowConfetti(true); if (!mutedRef.current) { playRef.current(); setTimeout(() => playApplauseRef.current(1), 200) }; setTimeout(() => setShowConfetti(false), 3500) }, 4000)
        setTimeout(() => setPhase('complete'), 5500)
      } else { setPhase('complete') }
    } catch { setError('שגיאה בטעינת הנתונים.'); setLoading(false) }
  }, [eventId])

  useEffect(() => { fetchAll() }, [fetchAll])
  function handleRefresh() { fetchAll({ silent: phase === 'complete' }) }
  function handleSkip() { setPhase('complete'); setShowConfetti(false) }
  function handleSoundToggle() { toggleMute(); if (muted) play() }

  const rankedP = useMemo(() => computeRanks(participantData), [participantData])
  const rankedG = useMemo(() => computeRanks(groupData), [groupData])
  const hasGroups = groupData.length > 0
  const taskCountByP = useMemo(() => { const m = new Map<string, number>(); for (const tx of transactions) m.set(tx.participant_id, (m.get(tx.participant_id) || 0) + 1); return m }, [transactions])
  const groupTaskCounts = useMemo(() => { const m = new Map<string, number>(); for (const [pid, c] of taskCountByP) { const g = pgMap.get(pid); if (g) m.set(g.id, (m.get(g.id) || 0) + c) }; return m }, [taskCountByP, pgMap])
  const topPByGroup = useMemo(() => { const m = new Map<string, { name: string }>(); for (const p of rankedP) { const g = pgMap.get(p.participant_id); if (!g) continue; if (!m.has(g.id)) m.set(g.id, { name: p.participant_name }) }; return m }, [rankedP, pgMap])
  const taskStats = useMemo(() => { const m = new Map<string, { name: string; count: number; points: number }>(); for (const tx of transactions) { const c = m.get(tx.action_id); if (c) { c.count++; c.points += tx.points } else m.set(tx.action_id, { name: tx.action?.name ?? '', count: 1, points: tx.points }) }; return [...m.values()].sort((a, b) => b.count - a.count) }, [transactions])
  const recentActivity = useMemo(() => transactions.slice(0, 5), [transactions])
  const showTasksCol = taskStats.length > 1

  if (loading) {
    return (
      <CenteredLoader className="py-16">
        <Spinner size="lg" className="border-warning" />
      </CenteredLoader>
    )
  }
  if (error) return <ErrorAlert message={error} />
  if (rankedP.length === 0 && rankedG.length === 0) return <LeaderboardEmptyState />

  const champ = rankedP[0]; const champGroup = champ ? pgMap.get(champ.participant_id) : undefined
  const gChamp = rankedG[0]
  const p2 = rankedP.find((p) => p.rank === 2); const p3 = rankedP.find((p) => p.rank === 3)
  const g2 = rankedG.find((g) => g.rank === 2); const g3 = rankedG.find((g) => g.rank === 3)
  const colCount = hasGroups && showTasksCol ? 3 : hasGroups || showTasksCol ? 2 : 1
  const isRevealed = phase === 'revealed' || phase === 'complete'

  return (
    <motion.div className="-mx-4 -mt-6 md:-mt-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
      {showConfetti && (<div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">{confettiPieces.map((p, i) => (<div key={i} className="absolute opacity-0 animate-confetti-fall" style={{ left: p.left, top: 0, width: p.size, height: p.size, backgroundColor: p.color, animationDelay: p.delay, transform: `rotate(${p.rotation}deg)`, borderRadius: p.isCircle ? '50%' : '2px' }} />))}</div>)}
      <AnimatePresence>{phase === 'revealed' && (<motion.div className="pointer-events-none fixed inset-0 z-30 bg-warning/15" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.4, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} />)}</AnimatePresence>

      <div className="min-h-screen bg-app-radial px-4 pt-6 pb-10 md:pt-8">
        <div className="mx-auto max-w-6xl">

          {/* ═══ HEADER ═══ */}
          <motion.div className="mb-10 flex items-center justify-between" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
            <SoundToggle muted={muted} onToggle={handleSoundToggle} />
            <div className="flex flex-col items-center gap-2.5">
              {eventLogoUrl ? (
                <motion.img src={eventLogoUrl} alt={eventName || ''} className="h-16 w-16 rounded-2xl object-cover shadow-xl"
                  style={{ boxShadow: '0 0 24px color-mix(in srgb, var(--color-primary) 25%, transparent)' }}
                  animate={{ boxShadow: ['0 0 24px color-mix(in srgb, var(--color-primary) 18%, transparent)', '0 0 40px color-mix(in srgb, var(--color-primary) 32%, transparent)', '0 0 24px color-mix(in srgb, var(--color-primary) 18%, transparent)'] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
              ) : eventName ? (
                <motion.div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated text-xl font-black text-foreground shadow-xl"
                  animate={{ boxShadow: ['0 0 24px color-mix(in srgb, var(--color-primary) 18%, transparent)', '0 0 40px color-mix(in srgb, var(--color-primary) 32%, transparent)', '0 0 24px color-mix(in srgb, var(--color-primary) 18%, transparent)'] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>{eventName.slice(0, 2)}</motion.div>
              ) : null}
              <div className="flex items-center gap-2.5">
                <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
                  <Trophy size={30} className="text-warning" fill="currentColor" style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.5))' }} />
                </motion.div>
                <h1 className="text-3xl font-black text-foreground sm:text-4xl">שיאים</h1>
              </div>
              {eventName && <p className="text-sm font-medium text-foreground">{eventName}</p>}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_6px_color-mix(in_srgb,var(--color-success)_60%,transparent)]" /></span>
                <span className="text-[11px] font-semibold text-success/80">LIVE</span>
              </div>
            </div>
            <div className="w-10" />
          </motion.div>

          {/* ═══ SUSPENSE / CHAMPION HEROES ═══ */}
          {champ && (
            <div className="mb-10">
              {phase === 'suspense' && (
                <motion.div className="flex flex-col items-center gap-6 py-16" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                    <Sparkles size={56} className="text-warning" style={{ filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.7))' }} />
                  </motion.div>
                  <motion.p className="text-4xl font-black text-warning sm:text-5xl md:text-6xl" style={{ textShadow: '0 0 30px color-mix(in srgb, var(--color-warning) 40%, transparent)' }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    ...מי יהיו האלופים?
                  </motion.p>
                  <button onClick={handleSkip} className="mt-2 text-xs text-muted transition-colors hover:text-foreground">דלג ←</button>
                </motion.div>
              )}

              {(phase === 'counting' || isRevealed) && (
                <div className={`grid gap-6 ${hasGroups && gChamp ? 'sm:grid-cols-2' : ''}`}>
                  {/* Participant champion */}
                  <motion.div className="relative overflow-hidden rounded-3xl border-2 border-warning/35 bg-surface p-8 text-center shadow-card"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                    whileHover={isRevealed ? { scale: 1.015, boxShadow: '0 0 60px rgba(234,179,8,0.2)' } : undefined}>
                    {isRevealed && (
                      <motion.div className="pointer-events-none absolute inset-0 rounded-3xl"
                        style={{ border: '2px solid rgba(234,179,8,0.4)' }}
                        animate={{ boxShadow: ['0 0 25px rgba(234,179,8,0.12), inset 0 0 25px rgba(234,179,8,0.04)', '0 0 55px rgba(234,179,8,0.3), inset 0 0 45px rgba(234,179,8,0.08)', '0 0 25px rgba(234,179,8,0.12), inset 0 0 25px rgba(234,179,8,0.04)'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
                    )}
                    <div className="absolute inset-0 opacity-[0.08]" style={{ background: 'radial-gradient(circle at 50% 15%, color-mix(in srgb, var(--color-warning) 50%, transparent), transparent 60%)' }} />
                    {isRevealed && sparkles.map((s, i) => (
                      <motion.div key={i} className="pointer-events-none absolute rounded-full bg-warning/30" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
                        animate={{ opacity: [0, 0.9, 0], scale: [0.3, 1.8, 0.3] }}
                        transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }} />
                    ))}
                    <div className="relative">
                      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
                        <motion.div animate={isRevealed ? { filter: ['drop-shadow(0 0 8px rgba(234,179,8,0.5))', 'drop-shadow(0 0 24px rgba(234,179,8,0.9))', 'drop-shadow(0 0 8px rgba(234,179,8,0.5))'] } : undefined}
                          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
                          <Crown size={42} className="mx-auto mb-3 text-warning" fill="currentColor" style={{ filter: 'drop-shadow(0 0 12px rgba(250,204,21,0.6))' }} />
                        </motion.div>
                      </motion.div>
                      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-warning/80">אלוף המשתתפים</p>
                      <p className="text-5xl font-black text-warning tabular-nums" style={{ textShadow: '0 0 20px rgba(250,204,21,0.3)' }}><AnimatedNumber value={champ.total_points} duration={2500} /></p>
                      <p className="mb-5 text-sm text-muted">נקודות</p>
                      {!isRevealed ? (
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-warning/30">
                          <motion.span className="text-3xl text-warning/40" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>?</motion.span>
                        </div>
                      ) : (
                        <motion.div initial={{ opacity: 0, scale: 0.8, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
                          <div className="mx-auto mb-3 w-fit"><AvatarCircle name={champ.participant_name} size="lg" ringColor="var(--color-warning)" /></div>
                          <h2 className="text-2xl font-black text-foreground" style={{ textShadow: '0 0 10px rgba(255,255,255,0.1)' }}>{champ.participant_name}</h2>
                          {champGroup && <p className="mt-1.5 text-sm text-muted">{champGroup.name}</p>}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>

                  {hasGroups && gChamp && (
                    <motion.div className="relative overflow-hidden rounded-3xl border-2 border-warning/35 bg-surface p-8 text-center shadow-card"
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                      whileHover={isRevealed ? { scale: 1.015, boxShadow: '0 0 60px rgba(234,179,8,0.2)' } : undefined}>
                      {isRevealed && (
                        <motion.div className="pointer-events-none absolute inset-0 rounded-3xl" style={{ border: '2px solid rgba(234,179,8,0.4)' }}
                          animate={{ boxShadow: ['0 0 25px rgba(234,179,8,0.12), inset 0 0 25px rgba(234,179,8,0.04)', '0 0 55px rgba(234,179,8,0.3), inset 0 0 45px rgba(234,179,8,0.08)', '0 0 25px rgba(234,179,8,0.12), inset 0 0 25px rgba(234,179,8,0.04)'] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} />
                      )}
                      <div className="absolute inset-0 opacity-[0.08]" style={{ background: 'radial-gradient(circle at 50% 15%, color-mix(in srgb, var(--color-warning) 50%, transparent), transparent 60%)' }} />
                      {isRevealed && sparkles.map((s, i) => (
                        <motion.div key={i} className="pointer-events-none absolute rounded-full bg-warning/30" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
                          animate={{ opacity: [0, 0.9, 0], scale: [0.3, 1.8, 0.3] }}
                          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay + 1, ease: 'easeInOut' }} />
                      ))}
                      <div className="relative">
                        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}>
                          <motion.div animate={isRevealed ? { filter: ['drop-shadow(0 0 8px rgba(234,179,8,0.5))', 'drop-shadow(0 0 24px rgba(234,179,8,0.9))', 'drop-shadow(0 0 8px rgba(234,179,8,0.5))'] } : undefined}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}>
                            <Crown size={42} className="mx-auto mb-3 text-warning" fill="currentColor" style={{ filter: 'drop-shadow(0 0 12px rgba(250,204,21,0.6))' }} />
                          </motion.div>
                        </motion.div>
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-warning/80">אלופת הקבוצות</p>
                        <p className="text-5xl font-black text-warning tabular-nums" style={{ textShadow: '0 0 20px rgba(250,204,21,0.3)' }}><AnimatedNumber value={gChamp.total_points} duration={2500} /></p>
                        <p className="mb-5 text-sm text-muted">נקודות</p>
                        {!isRevealed ? (
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-warning/30">
                            <motion.span className="text-3xl text-warning/40" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}>?</motion.span>
                          </div>
                        ) : (
                          <motion.div initial={{ opacity: 0, scale: 0.8, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.15 }}>
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg" style={{ backgroundColor: gChamp.group_color + '35', boxShadow: `0 0 16px ${gChamp.group_color}30` }}>
                              <Users size={24} style={{ color: gChamp.group_color }} />
                            </div>
                            <h2 className="text-2xl font-black text-foreground" style={{ textShadow: '0 0 10px rgba(255,255,255,0.1)' }}>{gChamp.group_name}</h2>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                  {!isRevealed && <div className="col-span-full flex justify-center"><button onClick={handleSkip} className="text-xs text-muted hover:text-foreground">דלג ←</button></div>}
                </div>
              )}
            </div>
          )}

          {/* Everything below after reveal */}
          {phase === 'complete' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              {/* ═══ PODIUMS ═══ */}
              {(p2 || g2) && (
                <div className={`mb-10 grid gap-6 ${hasGroups && (g2 || g3) ? 'lg:grid-cols-2' : ''}`}>
                  {(p2 || p3) && (
                    <motion.div className="overflow-hidden rounded-2xl border border-border p-6 transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
                      style={{ background: 'linear-gradient(180deg, rgba(26,20,51,0.9) 0%, rgba(13,9,32,0.8) 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <div className="mb-5 flex items-center justify-center gap-2.5">
                        <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}>
                          <Award size={22} className="text-warning" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.4))' }} />
                        </motion.div>
                        <h3 className="text-lg font-black text-foreground">פודיום משתתפים</h3>
                      </div>
                      <div className="flex items-end justify-center gap-8">
                        {p2 && (<motion.div className="flex w-32 flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                          <AvatarCircle name={p2.participant_name} size="md" ringColor="var(--color-muted)" />
                          <p className="mt-2 truncate text-sm font-black text-foreground w-full text-center">{p2.participant_name}</p>
                          <p className="text-xs font-bold text-foreground tabular-nums">{p2.total_points.toLocaleString('he-IL')} נק׳</p>
                          <div className="mt-3 flex h-20 w-full items-end justify-center rounded-t-xl" style={{ background: 'linear-gradient(to top, rgba(161,161,170,0.2), transparent)', boxShadow: '0 0 15px rgba(161,161,170,0.1)' }}>
                            <span className="mb-2 text-3xl">🥈</span></div>
                        </motion.div>)}
                        {p3 && (<motion.div className="flex w-32 flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                          <AvatarCircle name={p3.participant_name} size="md" ringColor="var(--color-accent)" />
                          <p className="mt-2 truncate text-sm font-black text-foreground w-full text-center">{p3.participant_name}</p>
                          <p className="text-xs font-bold text-foreground tabular-nums">{p3.total_points.toLocaleString('he-IL')} נק׳</p>
                          <div className="mt-3 flex h-14 w-full items-end justify-center rounded-t-xl" style={{ background: 'linear-gradient(to top, rgba(234,88,12,0.2), transparent)', boxShadow: '0 0 15px rgba(234,88,12,0.1)' }}>
                            <span className="mb-2 text-3xl">🥉</span></div>
                        </motion.div>)}
                      </div>
                    </motion.div>
                  )}
                  {hasGroups && (g2 || g3) && (
                    <motion.div className="overflow-hidden rounded-2xl border border-border p-6 transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
                      style={{ background: 'linear-gradient(180deg, rgba(26,20,51,0.9) 0%, rgba(13,9,32,0.8) 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                      <div className="mb-5 flex items-center justify-center gap-2.5">
                        <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, delay: 0.5 }}>
                          <Award size={22} className="text-warning" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.4))' }} />
                        </motion.div>
                        <h3 className="text-lg font-black text-foreground">פודיום קבוצות</h3>
                      </div>
                      <div className="flex items-end justify-center gap-8">
                        {g2 && (<motion.div className="flex w-32 flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg" style={{ backgroundColor: g2.group_color + '30', boxShadow: `0 0 14px ${g2.group_color}35` }}><Users size={20} style={{ color: g2.group_color }} /></div>
                          <p className="mt-2 truncate text-sm font-black text-foreground w-full text-center">{g2.group_name}</p>
                          <p className="text-xs font-bold text-foreground tabular-nums">{g2.total_points.toLocaleString('he-IL')} נק׳</p>
                          <div className="mt-3 flex h-20 w-full items-end justify-center rounded-t-xl" style={{ background: 'linear-gradient(to top, rgba(161,161,170,0.2), transparent)', boxShadow: '0 0 15px rgba(161,161,170,0.1)' }}>
                            <span className="mb-2 text-3xl">🥈</span></div>
                        </motion.div>)}
                        {g3 && (<motion.div className="flex w-32 flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg" style={{ backgroundColor: g3.group_color + '30', boxShadow: `0 0 14px ${g3.group_color}35` }}><Users size={20} style={{ color: g3.group_color }} /></div>
                          <p className="mt-2 truncate text-sm font-black text-foreground w-full text-center">{g3.group_name}</p>
                          <p className="text-xs font-bold text-foreground tabular-nums">{g3.total_points.toLocaleString('he-IL')} נק׳</p>
                          <div className="mt-3 flex h-14 w-full items-end justify-center rounded-t-xl" style={{ background: 'linear-gradient(to top, rgba(234,88,12,0.2), transparent)', boxShadow: '0 0 15px rgba(234,88,12,0.1)' }}>
                            <span className="mb-2 text-3xl">🥉</span></div>
                        </motion.div>)}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ═══ RANKING COLUMNS ═══ */}
              <div className={`grid gap-5 ${colCount === 3 ? 'lg:grid-cols-3' : colCount === 2 ? 'lg:grid-cols-2' : ''}`}>
                <motion.div className="cursor-pointer rounded-2xl border border-border overflow-hidden transition-all hover:border-secondary/30 hover:shadow-card hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(180deg, rgba(26,20,51,0.85) 0%, rgba(13,9,32,0.9) 100%)', boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} onClick={() => setExpanded('participants')}>
                  <div className="flex items-center gap-2.5 border-b border-border px-5 py-4"><Users size={18} className="text-secondary" /><h3 className="text-sm font-black text-foreground">שיאנים לפי משתתפים</h3></div>
                  <div>
                    {rankedP.filter(p => p.total_points > 0).slice(0, 4).length === 0 ? (
                      <p className="px-5 py-6 text-center text-sm text-muted">אין ניקוד עדיין</p>
                    ) : rankedP.filter(p => p.total_points > 0).slice(0, 4).map((p, idx) => { const g = pgMap.get(p.participant_id); const tc = taskCountByP.get(p.participant_id) || 0; const rg = RANK_GLOW[p.rank]; const rbg = RANK_ROW_BG[p.rank]; return (
                      <motion.div key={p.participant_id} className="flex items-center gap-3 border-b border-border px-5 py-3.5 transition-all hover:bg-surface-elevated"
                        style={{ boxShadow: rg || 'none', borderInlineStartWidth: p.rank <= 3 ? 3 : 0, borderInlineStartStyle: 'solid', borderInlineStartColor: RANK_BG[p.rank] || 'transparent', backgroundColor: rbg || 'transparent' }}
                        initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + idx * 0.07 }}>
                        <RankCircle rank={p.rank} /><AvatarCircle name={p.participant_name} size="sm" ringColor={g?.color} />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-foreground">{p.participant_name}</p><div className="flex items-center gap-2 text-[11px] text-muted">{g && <span className="flex items-center gap-1">{g.name}<span className="h-1.5 w-1.5 rounded-full shadow-sm" style={{ backgroundColor: g.color }} /></span>}{tc > 0 && <span>{tc} משימות</span>}</div></div>
                        <div className="shrink-0 text-left"><span className="text-lg font-black text-foreground tabular-nums">{p.total_points.toLocaleString('he-IL')}</span><span className="mr-1 text-[10px] text-muted">נק׳</span></div>
                      </motion.div>
                    ) })}
                  </div>
                </motion.div>
                {hasGroups && (
                  <motion.div className="cursor-pointer rounded-2xl border border-border overflow-hidden transition-all hover:border-secondary/30 hover:shadow-card hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(180deg, rgba(26,20,51,0.85) 0%, rgba(13,9,32,0.9) 100%)', boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} onClick={() => setExpanded('groups')}>
                    <div className="flex items-center gap-2.5 border-b border-border px-5 py-4"><Trophy size={18} className="text-warning" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.4))' }} /><h3 className="text-sm font-black text-foreground">שיאנים לפי קבוצות</h3></div>
                    <div>
                      {rankedG.filter(g => g.total_points > 0).slice(0, 4).length === 0 ? (
                        <p className="px-5 py-6 text-center text-sm text-muted">אין ניקוד עדיין</p>
                      ) : rankedG.filter(g => g.total_points > 0).slice(0, 4).map((g, idx) => { const tc = groupTaskCounts.get(g.group_id) || 0; const ch = topPByGroup.get(g.group_id); const rg = RANK_GLOW[g.rank]; const rbg = RANK_ROW_BG[g.rank]; return (
                        <motion.div key={g.group_id} className="border-b border-border px-5 py-3.5 transition-all hover:bg-surface-elevated"
                          style={{ boxShadow: rg || 'none', borderInlineStartWidth: g.rank <= 3 ? 3 : 0, borderInlineStartStyle: 'solid' as const, borderInlineStartColor: RANK_BG[g.rank] || 'transparent', backgroundColor: rbg || 'transparent' }}
                          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.07 }}>
                          <div className="flex items-center gap-3"><RankCircle rank={g.rank} /><span className="h-5 w-5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: g.group_color, boxShadow: `0 0 8px ${g.group_color}40` }} />
                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-foreground">{g.group_name}</p><div className="text-[11px] text-muted">{g.total_points.toLocaleString('he-IL')} נק׳{tc > 0 ? ` · ${tc} משימות` : ''}</div>{ch && <div className="flex items-center gap-1 text-[11px] text-muted"><Crown size={10} className="text-warning/60" />שיאן: <span className="font-semibold text-foreground">{ch.name}</span></div>}</div>
                            <span className="shrink-0 text-lg font-black text-foreground tabular-nums">{g.total_points.toLocaleString('he-IL')}</span>
                          </div>
                        </motion.div>
                      ) })}
                    </div>
                  </motion.div>
                )}
                {showTasksCol && (
                  <motion.div className="cursor-pointer rounded-2xl border border-border overflow-hidden transition-all hover:border-success/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(180deg, rgba(26,20,51,0.85) 0%, rgba(13,9,32,0.9) 100%)', boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} onClick={() => setExpanded('tasks')}>
                    <div className="flex items-center gap-2.5 border-b border-border px-5 py-4"><ClipboardCheck size={18} className="text-success" style={{ filter: 'drop-shadow(0 0 4px rgba(52,211,153,0.4))' }} /><h3 className="text-sm font-black text-foreground">המשימות שבוצעו הכי הרבה</h3></div>
                    <div>
                      {taskStats.slice(0, 4).map((t, idx) => { const tRank = idx + 1; const rg = RANK_GLOW[tRank]; const rbg = RANK_ROW_BG[tRank]; return (
                        <motion.div key={t.name} className="flex items-center gap-3 border-b border-border px-5 py-3.5 transition-all hover:bg-surface-elevated"
                          style={{ boxShadow: rg || 'none', borderInlineStartWidth: tRank <= 3 ? 3 : 0, borderInlineStartStyle: 'solid' as const, borderInlineStartColor: RANK_BG[tRank] || 'transparent', backgroundColor: rbg || 'transparent' }}
                          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + idx * 0.07 }}>
                          <RankCircle rank={tRank} />
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-foreground">{t.name}</p><p className="text-[11px] text-muted">{t.count} השלמות · {t.points.toLocaleString('he-IL')} נק׳ הוענקו</p></div>
                          <span className="shrink-0 text-lg font-black text-foreground tabular-nums">{t.count}</span>
                        </motion.div>
                      ) })}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ═══ ACTIVITY ═══ */}
              {recentActivity.length > 0 && (
                <motion.div className="mt-6 overflow-hidden rounded-2xl border border-secondary/15"
                  style={{ background: 'linear-gradient(180deg, rgba(13,9,32,0.9) 0%, rgba(8,5,22,0.95) 100%)', boxShadow: '0 0 20px rgba(6,182,212,0.05)' }}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <div className="flex items-center gap-2.5 border-b border-secondary/10 px-5 py-3">
                    <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-secondary shadow-[0_0_6px_rgba(34,211,238,0.6)]" /></span>
                    <span className="text-xs font-black text-secondary/90">פעילות אחרונה</span>
                  </div>
                  <div>
                    {recentActivity.map((tx, idx) => { const pos = tx.points >= 0; return (
                      <motion.div key={tx.id} className="flex items-center gap-3 border-b border-border px-5 py-2.5 transition-colors hover:bg-surface-elevated"
                        style={idx === 0 ? { backgroundColor: 'rgba(6,182,212,0.04)' } : undefined}
                        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + idx * 0.06 }}>
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${pos ? 'bg-success/20' : 'bg-danger/20'}`}>
                          {pos ? <ArrowUp size={12} className="text-success" /> : <ArrowDown size={12} className="text-danger" />}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground"><span className="font-bold text-foreground">{tx.participant?.name}</span> ביצע <span className="font-medium text-foreground">{tx.action?.name}</span></span>
                        <span className={`shrink-0 text-xs font-black tabular-nums ${pos ? 'text-success' : 'text-danger'}`}>{pos ? '+' : ''}{tx.points}</span>
                        <span className="shrink-0 text-[10px] text-muted">{formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: he })}</span>
                      </motion.div>
                    ) })}
                  </div>
                </motion.div>
              )}

              <motion.div className="mt-6 flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <button onClick={handleRefresh} className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-6 py-3 text-sm font-semibold text-foreground shadow-lg transition-all hover:bg-surface-elevated hover:text-foreground hover:shadow-xl hover:-translate-y-0.5 active:scale-95">
                  <RotateCcw size={15} />הפעלה מחדש
                </button>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}
      {expanded === 'participants' && (
        <DetailModal title="דירוג משתתפים" onClose={() => setExpanded(null)}>
          <div className="space-y-1.5">{rankedP.filter(p => p.total_points > 0).length === 0 ? (<p className="py-6 text-center text-sm text-muted">אין ניקוד עדיין</p>) : rankedP.filter(p => p.total_points > 0).map((p) => { const g = pgMap.get(p.participant_id); const tc = taskCountByP.get(p.participant_id) || 0; return (
            <div key={p.participant_id} className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 transition-colors hover:bg-surface-elevated"
              style={{ backgroundColor: RANK_ROW_BG[p.rank] || 'rgba(255,255,255,0.02)', borderInlineStartWidth: p.rank <= 3 ? 3 : 0, borderInlineStartColor: RANK_BG[p.rank] || 'transparent', borderInlineStartStyle: 'solid' }}>
              <RankCircle rank={p.rank} /><AvatarCircle name={p.participant_name} size="sm" ringColor={g?.color} />
              <div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">{p.participant_name}</p><div className="flex items-center gap-2 text-[10px] text-muted">{g && <span>{g.name}</span>}{tc > 0 && <span>{tc} משימות</span>}</div></div>
              <span className="text-sm font-black text-foreground tabular-nums">{p.total_points.toLocaleString('he-IL')}</span>
            </div>) })}</div>
        </DetailModal>
      )}
      {expanded === 'groups' && (
        <DetailModal title="דירוג קבוצות" onClose={() => setExpanded(null)}>
          <div className="space-y-1.5">{rankedG.filter(g => g.total_points > 0).length === 0 ? (<p className="py-6 text-center text-sm text-muted">אין ניקוד עדיין</p>) : rankedG.filter(g => g.total_points > 0).map((g) => { const tc = groupTaskCounts.get(g.group_id) || 0; const ch = topPByGroup.get(g.group_id); return (
            <div key={g.group_id} className="rounded-xl px-3.5 py-3 transition-colors hover:bg-surface-elevated"
              style={{ backgroundColor: RANK_ROW_BG[g.rank] || 'rgba(255,255,255,0.02)', borderInlineStartWidth: g.rank <= 3 ? 3 : 0, borderInlineStartColor: RANK_BG[g.rank] || 'transparent', borderInlineStartStyle: 'solid' }}>
              <div className="flex items-center gap-2.5"><RankCircle rank={g.rank} /><span className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: g.group_color, boxShadow: `0 0 6px ${g.group_color}40` }} /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">{g.group_name}</p><div className="flex items-center gap-2 text-[10px] text-muted">{tc > 0 && <span>{tc} משימות</span>}{ch && <span>שיאן: {ch.name}</span>}</div></div><span className="text-sm font-black text-foreground tabular-nums">{g.total_points.toLocaleString('he-IL')}</span></div>
            </div>) })}</div>
        </DetailModal>
      )}
      {expanded === 'tasks' && (
        <DetailModal title="כל המשימות" onClose={() => setExpanded(null)}>
          <div className="space-y-1.5">{taskStats.map((t, i) => (
            <div key={t.name} className="flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-surface-elevated"
              style={{ backgroundColor: RANK_ROW_BG[i + 1] || 'rgba(255,255,255,0.02)', borderInlineStartWidth: i < 3 ? 3 : 0, borderInlineStartColor: RANK_BG[i + 1] || 'transparent', borderInlineStartStyle: 'solid' }}>
              <RankCircle rank={i + 1} /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">{t.name}</p><p className="text-[10px] text-muted">{t.points.toLocaleString('he-IL')} נק׳ הוענקו</p></div><span className="text-sm font-black text-foreground tabular-nums">{t.count} השלמות</span>
            </div>
          ))}</div>
        </DetailModal>
      )}
    </motion.div>
  )
}
