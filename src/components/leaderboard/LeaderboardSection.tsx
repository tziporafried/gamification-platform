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
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import type { ParticipantLeaderboardEntry, GroupLeaderboardEntry } from '@/types'

interface LeaderboardSectionProps { eventId: string; themeColor: string; eventName?: string; eventLogoUrl?: string | null }
interface TxRow { id: string; participant_id: string; action_id: string; points: number; created_at: string; participant: { name: string; external_id: string }; action: { name: string; code: string } }
interface PgMapping { participant_id: string; groups: { id: string; name: string; color: string } | null }

function computeRanks<T extends { total_points: number }>(entries: T[]): (T & { rank: number })[] {
  let r = 1; return entries.map((e, i) => { if (i > 0 && e.total_points < entries[i - 1].total_points) r = i + 1; return { ...e, rank: r } })
}

const RANK_BG: Record<number, string> = { 1: '#eab308', 2: '#a1a1aa', 3: '#ea580c' }
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
const CONFETTI_COLORS = ['#fbbf24', '#f59e0b', '#d97706', '#7c3aed', '#a855f7', '#ec4899', '#22c55e', '#06b6d4']

type RevealPhase = 'loading' | 'suspense' | 'counting' | 'revealed' | 'complete'

function RankCircle({ rank }: { rank: number }) {
  const bg = RANK_BG[rank]
  return (
    <motion.div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-lg"
      style={{ backgroundColor: bg || 'rgba(63,63,70,0.7)', boxShadow: RANK_GLOW[rank] || 'none' }}
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
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
        <motion.div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0920] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] max-h-[85vh] overflow-y-auto"
          initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ duration: 0.25 }}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-black text-white">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-white/10 hover:text-white hover:scale-110"><X size={18} /></button>
          </div>{children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export function LeaderboardSection({ eventId, themeColor, eventName, eventLogoUrl }: LeaderboardSectionProps) {
  const [participantData, setParticipantData] = useState<ParticipantLeaderboardEntry[]>([])
  const [groupData, setGroupData] = useState<GroupLeaderboardEntry[]>([])
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [pgMap, setPgMap] = useState<Map<string, { id: string; name: string; color: string }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [phase, setPhase] = useState<RevealPhase>('loading')
  const [showConfetti, setShowConfetti] = useState(false)
  const { play, playApplause, muted, toggleMute } = useSound()

  const confettiPieces = useMemo(() => Array.from({ length: 60 }, () => ({
    left: `${Math.random() * 100}%`, delay: `${Math.random() * 1.8}s`,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 4 + Math.random() * 8, rotation: Math.random() * 360, isCircle: Math.random() > 0.5,
  })), [])

  const sparkles = useMemo(() => Array.from({ length: 12 }, () => ({
    left: 5 + Math.random() * 90, top: 5 + Math.random() * 90,
    duration: 1.5 + Math.random() * 2, delay: Math.random() * 3, size: 1.5 + Math.random() * 2.5,
  })), [])

  const fetchAll = useCallback(async () => {
    setError(''); setLoading(true); setPhase('loading')
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
      if (pData.length > 0) {
        setPhase('suspense')
        setTimeout(() => { setPhase('counting'); if (!muted) play() }, 1500)
        setTimeout(() => { setPhase('revealed'); setShowConfetti(true); if (!muted) { play(); setTimeout(() => playApplause(1), 200) }; setTimeout(() => setShowConfetti(false), 3500) }, 4000)
        setTimeout(() => setPhase('complete'), 5500)
      } else { setPhase('complete') }
    } catch { setError('שגיאה בטעינת הנתונים.'); setLoading(false) }
  }, [eventId, play, playApplause, muted])

  useEffect(() => { fetchAll() }, [fetchAll])
  function handleRefresh() { setRefreshKey((k) => k + 1); fetchAll() }
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

  if (loading) return <div className="flex justify-center py-16"><div className="h-9 w-9 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>
  if (error) return <ErrorAlert message={error} />
  if (rankedP.length === 0 && rankedG.length === 0) return <LeaderboardEmptyState themeColor={themeColor} />

  const champ = rankedP[0]; const champGroup = champ ? pgMap.get(champ.participant_id) : undefined
  const gChamp = rankedG[0]
  const p2 = rankedP.find((p) => p.rank === 2); const p3 = rankedP.find((p) => p.rank === 3)
  const g2 = rankedG.find((g) => g.rank === 2); const g3 = rankedG.find((g) => g.rank === 3)
  const colCount = hasGroups && showTasksCol ? 3 : hasGroups || showTasksCol ? 2 : 1
  const isRevealed = phase === 'revealed' || phase === 'complete'

  return (
    <motion.div className="-mx-4 -mt-6 md:-mt-8" key={refreshKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
      {showConfetti && (<div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">{confettiPieces.map((p, i) => (<div key={i} className="absolute opacity-0 animate-confetti-fall" style={{ left: p.left, top: 0, width: p.size, height: p.size, backgroundColor: p.color, animationDelay: p.delay, transform: `rotate(${p.rotation}deg)`, borderRadius: p.isCircle ? '50%' : '2px' }} />))}</div>)}
      <AnimatePresence>{phase === 'revealed' && (<motion.div className="pointer-events-none fixed inset-0 z-30 bg-amber-400/15" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.4, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} />)}</AnimatePresence>

      <div className="min-h-screen bg-[#080516] px-4 pt-6 pb-10 md:pt-8" style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, #1a1040 0%, #080516 60%)' }}>
        <div className="mx-auto max-w-6xl">

          {/* ═══ HEADER ═══ */}
          <motion.div className="mb-10 flex items-center justify-between" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
            <SoundToggle muted={muted} onToggle={handleSoundToggle} themeColor={themeColor} />
            <div className="flex flex-col items-center gap-2.5">
              {eventLogoUrl ? (
                <motion.img src={eventLogoUrl} alt={eventName || ''} className="h-16 w-16 rounded-2xl object-cover shadow-xl"
                  style={{ boxShadow: `0 0 24px ${themeColor}40` }}
                  animate={{ boxShadow: [`0 0 24px ${themeColor}30`, `0 0 40px ${themeColor}50`, `0 0 24px ${themeColor}30`] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
              ) : eventName ? (
                <motion.div className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black text-white shadow-xl"
                  style={{ backgroundColor: themeColor + '30' }}
                  animate={{ boxShadow: [`0 0 24px ${themeColor}30`, `0 0 40px ${themeColor}50`, `0 0 24px ${themeColor}30`] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>{eventName.slice(0, 2)}</motion.div>
              ) : null}
              <div className="flex items-center gap-2.5">
                <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
                  <Trophy size={30} className="text-amber-400" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.5))' }} />
                </motion.div>
                <h1 className="text-3xl font-black text-white sm:text-4xl" style={{ textShadow: '0 0 20px rgba(255,255,255,0.1)' }}>שיאים</h1>
              </div>
              {eventName && <p className="text-sm font-medium text-gray-300">{eventName}</p>}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" /></span>
                <span className="text-[11px] font-semibold text-emerald-400/80">LIVE</span>
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
                    <Sparkles size={56} className="text-amber-400" style={{ filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.7))' }} />
                  </motion.div>
                  <motion.p className="text-4xl font-black sm:text-5xl md:text-6xl" style={{ color: '#fbbf24', textShadow: '0 0 30px rgba(251,191,36,0.4)' }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    ...מי יהיו האלופים?
                  </motion.p>
                  <button onClick={handleSkip} className="mt-2 text-xs text-gray-500 transition-colors hover:text-gray-300">דלג ←</button>
                </motion.div>
              )}

              {(phase === 'counting' || isRevealed) && (
                <div className={`grid gap-6 ${hasGroups && gChamp ? 'sm:grid-cols-2' : ''}`}>
                  {/* Participant champion */}
                  <motion.div className="relative overflow-hidden rounded-3xl p-8 text-center"
                    style={{ background: 'linear-gradient(135deg, rgba(26,16,64,0.9) 0%, rgba(13,9,32,0.95) 100%)', border: '2px solid rgba(234,179,8,0.35)', boxShadow: '0 0 40px rgba(234,179,8,0.1)' }}
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                    whileHover={isRevealed ? { scale: 1.015, boxShadow: '0 0 60px rgba(234,179,8,0.2)' } : undefined}>
                    {isRevealed && (
                      <motion.div className="pointer-events-none absolute inset-0 rounded-3xl"
                        style={{ border: '2px solid rgba(234,179,8,0.4)' }}
                        animate={{ boxShadow: ['0 0 25px rgba(234,179,8,0.12), inset 0 0 25px rgba(234,179,8,0.04)', '0 0 55px rgba(234,179,8,0.3), inset 0 0 45px rgba(234,179,8,0.08)', '0 0 25px rgba(234,179,8,0.12), inset 0 0 25px rgba(234,179,8,0.04)'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
                    )}
                    <div className="absolute inset-0 opacity-[0.08]" style={{ background: 'radial-gradient(circle at 50% 15%, #fbbf24, transparent 60%)' }} />
                    {isRevealed && sparkles.map((s, i) => (
                      <motion.div key={i} className="pointer-events-none absolute rounded-full bg-amber-300/50" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
                        animate={{ opacity: [0, 0.9, 0], scale: [0.3, 1.8, 0.3] }}
                        transition={{ duration: s.duration, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }} />
                    ))}
                    <div className="relative">
                      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
                        <motion.div animate={isRevealed ? { filter: ['drop-shadow(0 0 8px rgba(234,179,8,0.5))', 'drop-shadow(0 0 24px rgba(234,179,8,0.9))', 'drop-shadow(0 0 8px rgba(234,179,8,0.5))'] } : undefined}
                          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
                          <Crown size={42} className="mx-auto mb-3 text-yellow-400" fill="#facc15" style={{ filter: 'drop-shadow(0 0 12px rgba(250,204,21,0.6))' }} />
                        </motion.div>
                      </motion.div>
                      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400/80">אלוף המשתתפים</p>
                      <p className="text-5xl font-black text-yellow-400 tabular-nums" style={{ textShadow: '0 0 20px rgba(250,204,21,0.3)' }}><AnimatedNumber value={champ.total_points} duration={2500} /></p>
                      <p className="mb-5 text-sm text-gray-400">נקודות</p>
                      {!isRevealed ? (
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-yellow-400/30">
                          <motion.span className="text-3xl text-yellow-400/40" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>?</motion.span>
                        </div>
                      ) : (
                        <motion.div initial={{ opacity: 0, scale: 0.8, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
                          <div className="mx-auto mb-3 w-fit"><AvatarCircle name={champ.participant_name} size="lg" ringColor="#eab308" /></div>
                          <h2 className="text-2xl font-black text-white" style={{ textShadow: '0 0 10px rgba(255,255,255,0.1)' }}>{champ.participant_name}</h2>
                          {champGroup && <p className="mt-1.5 text-sm text-gray-400">{champGroup.name}</p>}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>

                  {hasGroups && gChamp && (
                    <motion.div className="relative overflow-hidden rounded-3xl p-8 text-center"
                      style={{ background: 'linear-gradient(135deg, rgba(26,16,64,0.9) 0%, rgba(13,9,32,0.95) 100%)', border: '2px solid rgba(234,179,8,0.35)', boxShadow: '0 0 40px rgba(234,179,8,0.1)' }}
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                      whileHover={isRevealed ? { scale: 1.015, boxShadow: '0 0 60px rgba(234,179,8,0.2)' } : undefined}>
                      {isRevealed && (
                        <motion.div className="pointer-events-none absolute inset-0 rounded-3xl" style={{ border: '2px solid rgba(234,179,8,0.4)' }}
                          animate={{ boxShadow: ['0 0 25px rgba(234,179,8,0.12), inset 0 0 25px rgba(234,179,8,0.04)', '0 0 55px rgba(234,179,8,0.3), inset 0 0 45px rgba(234,179,8,0.08)', '0 0 25px rgba(234,179,8,0.12), inset 0 0 25px rgba(234,179,8,0.04)'] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} />
                      )}
                      <div className="absolute inset-0 opacity-[0.08]" style={{ background: 'radial-gradient(circle at 50% 15%, #fbbf24, transparent 60%)' }} />
                      {isRevealed && sparkles.map((s, i) => (
                        <motion.div key={i} className="pointer-events-none absolute rounded-full bg-amber-300/50" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
                          animate={{ opacity: [0, 0.9, 0], scale: [0.3, 1.8, 0.3] }}
                          transition={{ duration: s.duration, repeat: Infinity, delay: s.delay + 1, ease: 'easeInOut' }} />
                      ))}
                      <div className="relative">
                        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}>
                          <motion.div animate={isRevealed ? { filter: ['drop-shadow(0 0 8px rgba(234,179,8,0.5))', 'drop-shadow(0 0 24px rgba(234,179,8,0.9))', 'drop-shadow(0 0 8px rgba(234,179,8,0.5))'] } : undefined}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}>
                            <Crown size={42} className="mx-auto mb-3 text-yellow-400" fill="#facc15" style={{ filter: 'drop-shadow(0 0 12px rgba(250,204,21,0.6))' }} />
                          </motion.div>
                        </motion.div>
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400/80">אלופת הקבוצות</p>
                        <p className="text-5xl font-black text-yellow-400 tabular-nums" style={{ textShadow: '0 0 20px rgba(250,204,21,0.3)' }}><AnimatedNumber value={gChamp.total_points} duration={2500} /></p>
                        <p className="mb-5 text-sm text-gray-400">נקודות</p>
                        {!isRevealed ? (
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-yellow-400/30">
                            <motion.span className="text-3xl text-yellow-400/40" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}>?</motion.span>
                          </div>
                        ) : (
                          <motion.div initial={{ opacity: 0, scale: 0.8, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.15 }}>
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg" style={{ backgroundColor: gChamp.group_color + '35', boxShadow: `0 0 16px ${gChamp.group_color}30` }}>
                              <Users size={24} style={{ color: gChamp.group_color }} />
                            </div>
                            <h2 className="text-2xl font-black text-white" style={{ textShadow: '0 0 10px rgba(255,255,255,0.1)' }}>{gChamp.group_name}</h2>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                  {!isRevealed && <div className="col-span-full flex justify-center"><button onClick={handleSkip} className="text-xs text-gray-500 hover:text-gray-300">דלג ←</button></div>}
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
                    <motion.div className="overflow-hidden rounded-2xl border border-white/[0.08] p-6 transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
                      style={{ background: 'linear-gradient(180deg, rgba(26,20,51,0.9) 0%, rgba(13,9,32,0.8) 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                      <div className="mb-5 flex items-center justify-center gap-2.5">
                        <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}>
                          <Award size={22} className="text-amber-400" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.4))' }} />
                        </motion.div>
                        <h3 className="text-lg font-black text-white">פודיום משתתפים</h3>
                      </div>
                      <div className="flex items-end justify-center gap-8">
                        {p2 && (<motion.div className="flex w-32 flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                          <AvatarCircle name={p2.participant_name} size="md" ringColor="#a1a1aa" />
                          <p className="mt-2 truncate text-sm font-black text-white w-full text-center">{p2.participant_name}</p>
                          <p className="text-xs font-bold text-gray-300 tabular-nums">{p2.total_points.toLocaleString('he-IL')} נק׳</p>
                          <div className="mt-3 flex h-20 w-full items-end justify-center rounded-t-xl" style={{ background: 'linear-gradient(to top, rgba(161,161,170,0.2), transparent)', boxShadow: '0 0 15px rgba(161,161,170,0.1)' }}>
                            <span className="mb-2 text-3xl">🥈</span></div>
                        </motion.div>)}
                        {p3 && (<motion.div className="flex w-32 flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                          <AvatarCircle name={p3.participant_name} size="md" ringColor="#ea580c" />
                          <p className="mt-2 truncate text-sm font-black text-white w-full text-center">{p3.participant_name}</p>
                          <p className="text-xs font-bold text-gray-300 tabular-nums">{p3.total_points.toLocaleString('he-IL')} נק׳</p>
                          <div className="mt-3 flex h-14 w-full items-end justify-center rounded-t-xl" style={{ background: 'linear-gradient(to top, rgba(234,88,12,0.2), transparent)', boxShadow: '0 0 15px rgba(234,88,12,0.1)' }}>
                            <span className="mb-2 text-3xl">🥉</span></div>
                        </motion.div>)}
                      </div>
                    </motion.div>
                  )}
                  {hasGroups && (g2 || g3) && (
                    <motion.div className="overflow-hidden rounded-2xl border border-white/[0.08] p-6 transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
                      style={{ background: 'linear-gradient(180deg, rgba(26,20,51,0.9) 0%, rgba(13,9,32,0.8) 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                      <div className="mb-5 flex items-center justify-center gap-2.5">
                        <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, delay: 0.5 }}>
                          <Award size={22} className="text-amber-400" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.4))' }} />
                        </motion.div>
                        <h3 className="text-lg font-black text-white">פודיום קבוצות</h3>
                      </div>
                      <div className="flex items-end justify-center gap-8">
                        {g2 && (<motion.div className="flex w-32 flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg" style={{ backgroundColor: g2.group_color + '30', boxShadow: `0 0 14px ${g2.group_color}35` }}><Users size={20} style={{ color: g2.group_color }} /></div>
                          <p className="mt-2 truncate text-sm font-black text-white w-full text-center">{g2.group_name}</p>
                          <p className="text-xs font-bold text-gray-300 tabular-nums">{g2.total_points.toLocaleString('he-IL')} נק׳</p>
                          <div className="mt-3 flex h-20 w-full items-end justify-center rounded-t-xl" style={{ background: 'linear-gradient(to top, rgba(161,161,170,0.2), transparent)', boxShadow: '0 0 15px rgba(161,161,170,0.1)' }}>
                            <span className="mb-2 text-3xl">🥈</span></div>
                        </motion.div>)}
                        {g3 && (<motion.div className="flex w-32 flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl shadow-lg" style={{ backgroundColor: g3.group_color + '30', boxShadow: `0 0 14px ${g3.group_color}35` }}><Users size={20} style={{ color: g3.group_color }} /></div>
                          <p className="mt-2 truncate text-sm font-black text-white w-full text-center">{g3.group_name}</p>
                          <p className="text-xs font-bold text-gray-300 tabular-nums">{g3.total_points.toLocaleString('he-IL')} נק׳</p>
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
                <motion.div className="cursor-pointer rounded-2xl border border-white/[0.07] overflow-hidden transition-all hover:border-brand-400/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(180deg, rgba(26,20,51,0.85) 0%, rgba(13,9,32,0.9) 100%)', boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} onClick={() => setExpanded('participants')}>
                  <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4"><Users size={18} className="text-brand-400" style={{ filter: 'drop-shadow(0 0 4px rgba(139,92,246,0.4))' }} /><h3 className="text-sm font-black text-white">שיאנים לפי משתתפים</h3></div>
                  <div>
                    {rankedP.slice(0, 4).map((p, idx) => { const g = pgMap.get(p.participant_id); const tc = taskCountByP.get(p.participant_id) || 0; const rg = RANK_GLOW[p.rank]; const rbg = RANK_ROW_BG[p.rank]; return (
                      <motion.div key={p.participant_id} className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-3.5 transition-all hover:bg-white/[0.04]"
                        style={{ boxShadow: rg || 'none', borderInlineStartWidth: p.rank <= 3 ? 3 : 0, borderInlineStartStyle: 'solid', borderInlineStartColor: RANK_BG[p.rank] || 'transparent', backgroundColor: rbg || 'transparent' }}
                        initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + idx * 0.07 }}>
                        <RankCircle rank={p.rank} /><AvatarCircle name={p.participant_name} size="sm" ringColor={g?.color} />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{p.participant_name}</p><div className="flex items-center gap-2 text-[11px] text-gray-400">{g && <span className="flex items-center gap-1">{g.name}<span className="h-1.5 w-1.5 rounded-full shadow-sm" style={{ backgroundColor: g.color }} /></span>}{tc > 0 && <span>{tc} משימות</span>}</div></div>
                        <div className="shrink-0 text-left"><span className="text-lg font-black text-white tabular-nums">{p.total_points.toLocaleString('he-IL')}</span><span className="mr-1 text-[10px] text-gray-500">נק׳</span></div>
                      </motion.div>
                    ) })}
                  </div>
                </motion.div>
                {hasGroups && (
                  <motion.div className="cursor-pointer rounded-2xl border border-white/[0.07] overflow-hidden transition-all hover:border-brand-400/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(180deg, rgba(26,20,51,0.85) 0%, rgba(13,9,32,0.9) 100%)', boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} onClick={() => setExpanded('groups')}>
                    <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4"><Trophy size={18} className="text-amber-400" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.4))' }} /><h3 className="text-sm font-black text-white">שיאנים לפי קבוצות</h3></div>
                    <div>
                      {rankedG.slice(0, 4).map((g, idx) => { const tc = groupTaskCounts.get(g.group_id) || 0; const ch = topPByGroup.get(g.group_id); const rg = RANK_GLOW[g.rank]; const rbg = RANK_ROW_BG[g.rank]; return (
                        <motion.div key={g.group_id} className="border-b border-white/[0.04] px-5 py-3.5 transition-all hover:bg-white/[0.04]"
                          style={{ boxShadow: rg || 'none', borderInlineStartWidth: g.rank <= 3 ? 3 : 0, borderInlineStartStyle: 'solid' as const, borderInlineStartColor: RANK_BG[g.rank] || 'transparent', backgroundColor: rbg || 'transparent' }}
                          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.07 }}>
                          <div className="flex items-center gap-3"><RankCircle rank={g.rank} /><span className="h-5 w-5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: g.group_color, boxShadow: `0 0 8px ${g.group_color}40` }} />
                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{g.group_name}</p><div className="text-[11px] text-gray-400">{g.total_points.toLocaleString('he-IL')} נק׳{tc > 0 ? ` · ${tc} משימות` : ''}</div>{ch && <div className="flex items-center gap-1 text-[11px] text-gray-400"><Crown size={10} className="text-amber-400/60" />שיאן: <span className="font-semibold text-gray-200">{ch.name}</span></div>}</div>
                            <span className="shrink-0 text-lg font-black text-white tabular-nums">{g.total_points.toLocaleString('he-IL')}</span>
                          </div>
                        </motion.div>
                      ) })}
                    </div>
                  </motion.div>
                )}
                {showTasksCol && (
                  <motion.div className="cursor-pointer rounded-2xl border border-white/[0.07] overflow-hidden transition-all hover:border-emerald-400/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(180deg, rgba(26,20,51,0.85) 0%, rgba(13,9,32,0.9) 100%)', boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} onClick={() => setExpanded('tasks')}>
                    <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4"><ClipboardCheck size={18} className="text-emerald-400" style={{ filter: 'drop-shadow(0 0 4px rgba(52,211,153,0.4))' }} /><h3 className="text-sm font-black text-white">המשימות שבוצעו הכי הרבה</h3></div>
                    <div>
                      {taskStats.slice(0, 4).map((t, idx) => { const tRank = idx + 1; const rg = RANK_GLOW[tRank]; const rbg = RANK_ROW_BG[tRank]; return (
                        <motion.div key={t.name} className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-3.5 transition-all hover:bg-white/[0.04]"
                          style={{ boxShadow: rg || 'none', borderInlineStartWidth: tRank <= 3 ? 3 : 0, borderInlineStartStyle: 'solid' as const, borderInlineStartColor: RANK_BG[tRank] || 'transparent', backgroundColor: rbg || 'transparent' }}
                          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + idx * 0.07 }}>
                          <RankCircle rank={tRank} />
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{t.name}</p><p className="text-[11px] text-gray-400">{t.count} השלמות · {t.points.toLocaleString('he-IL')} נק׳ הוענקו</p></div>
                          <span className="shrink-0 text-lg font-black text-white tabular-nums">{t.count}</span>
                        </motion.div>
                      ) })}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ═══ ACTIVITY ═══ */}
              {recentActivity.length > 0 && (
                <motion.div className="mt-6 overflow-hidden rounded-2xl border border-cyan-500/15"
                  style={{ background: 'linear-gradient(180deg, rgba(13,9,32,0.9) 0%, rgba(8,5,22,0.95) 100%)', boxShadow: '0 0 20px rgba(6,182,212,0.05)' }}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <div className="flex items-center gap-2.5 border-b border-cyan-500/10 px-5 py-3">
                    <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]" /></span>
                    <span className="text-xs font-black text-cyan-400/90">פעילות אחרונה</span>
                  </div>
                  <div>
                    {recentActivity.map((tx, idx) => { const pos = tx.points >= 0; return (
                      <motion.div key={tx.id} className="flex items-center gap-3 border-b border-white/[0.03] px-5 py-2.5 transition-colors hover:bg-white/[0.03]"
                        style={idx === 0 ? { backgroundColor: 'rgba(6,182,212,0.04)' } : undefined}
                        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + idx * 0.06 }}>
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${pos ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                          {pos ? <ArrowUp size={12} className="text-emerald-400" /> : <ArrowDown size={12} className="text-red-400" />}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs text-gray-300"><span className="font-bold text-white">{tx.participant?.name}</span> ביצע <span className="font-medium text-gray-200">{tx.action?.name}</span></span>
                        <span className={`shrink-0 text-xs font-black tabular-nums ${pos ? 'text-emerald-400' : 'text-red-400'}`}>{pos ? '+' : ''}{tx.points}</span>
                        <span className="shrink-0 text-[10px] text-gray-500">{formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale: he })}</span>
                      </motion.div>
                    ) })}
                  </div>
                </motion.div>
              )}

              <motion.div className="mt-6 flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <button onClick={handleRefresh} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-gray-300 shadow-lg transition-all hover:bg-white/[0.08] hover:text-white hover:shadow-xl hover:-translate-y-0.5 active:scale-95">
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
          <div className="space-y-1.5">{rankedP.map((p) => { const g = pgMap.get(p.participant_id); const tc = taskCountByP.get(p.participant_id) || 0; return (
            <div key={p.participant_id} className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 transition-colors hover:bg-white/[0.06]"
              style={{ backgroundColor: RANK_ROW_BG[p.rank] || 'rgba(255,255,255,0.02)', borderInlineStartWidth: p.rank <= 3 ? 3 : 0, borderInlineStartColor: RANK_BG[p.rank] || 'transparent', borderInlineStartStyle: 'solid' }}>
              <RankCircle rank={p.rank} /><AvatarCircle name={p.participant_name} size="sm" ringColor={g?.color} />
              <div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{p.participant_name}</p><div className="flex items-center gap-2 text-[10px] text-gray-400">{g && <span>{g.name}</span>}{tc > 0 && <span>{tc} משימות</span>}</div></div>
              <span className="text-sm font-black text-white tabular-nums">{p.total_points.toLocaleString('he-IL')}</span>
            </div>) })}</div>
        </DetailModal>
      )}
      {expanded === 'groups' && (
        <DetailModal title="דירוג קבוצות" onClose={() => setExpanded(null)}>
          <div className="space-y-1.5">{rankedG.map((g) => { const tc = groupTaskCounts.get(g.group_id) || 0; const ch = topPByGroup.get(g.group_id); return (
            <div key={g.group_id} className="rounded-xl px-3.5 py-3 transition-colors hover:bg-white/[0.06]"
              style={{ backgroundColor: RANK_ROW_BG[g.rank] || 'rgba(255,255,255,0.02)', borderInlineStartWidth: g.rank <= 3 ? 3 : 0, borderInlineStartColor: RANK_BG[g.rank] || 'transparent', borderInlineStartStyle: 'solid' }}>
              <div className="flex items-center gap-2.5"><RankCircle rank={g.rank} /><span className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: g.group_color, boxShadow: `0 0 6px ${g.group_color}40` }} /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{g.group_name}</p><div className="flex items-center gap-2 text-[10px] text-gray-400">{tc > 0 && <span>{tc} משימות</span>}{ch && <span>שיאן: {ch.name}</span>}</div></div><span className="text-sm font-black text-white tabular-nums">{g.total_points.toLocaleString('he-IL')}</span></div>
            </div>) })}</div>
        </DetailModal>
      )}
      {expanded === 'tasks' && (
        <DetailModal title="כל המשימות" onClose={() => setExpanded(null)}>
          <div className="space-y-1.5">{taskStats.map((t, i) => (
            <div key={t.name} className="flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-white/[0.06]"
              style={{ backgroundColor: RANK_ROW_BG[i + 1] || 'rgba(255,255,255,0.02)', borderInlineStartWidth: i < 3 ? 3 : 0, borderInlineStartColor: RANK_BG[i + 1] || 'transparent', borderInlineStartStyle: 'solid' }}>
              <RankCircle rank={i + 1} /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{t.name}</p><p className="text-[10px] text-gray-400">{t.points.toLocaleString('he-IL')} נק׳ הוענקו</p></div><span className="text-sm font-black text-white tabular-nums">{t.count} השלמות</span>
            </div>
          ))}</div>
        </DetailModal>
      )}
    </motion.div>
  )
}
