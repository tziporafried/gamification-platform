import { useState, useEffect, useCallback, useRef, FormEvent, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { hexToRgb, rgba } from '@/lib/accentColor'
import { Button } from '@/components/ui/Button'
import { PointsFlyUp } from '@/components/ui/PointsFlyUp'
import { Toast } from '@/components/ui/Toast'
import { CelebrationModal } from './CelebrationModal'
import { ScannerZone } from './ScannerZone'
import type { ScannerZoneRef } from './ScannerZone'
import { RecentActionsFeed } from './RecentActionsFeed'
import { ScanBackground } from './ScanBackground'
import { useScoreSubmit } from '@/hooks/useScoreSubmit'
import type { PointTransactionWithDetails, NewlyAwardedReward, Group, QrScoringMode } from '@/types'

interface ScoreEntryProps {
  eventId: string
  qrScoringMode: QrScoringMode
  themeColor: string
  eventName: string
  eventLogoUrl: string | null
}

interface ParticipantPreviewData {
  id: string; name: string; externalId: string; totalPoints: number; rank: number | null; groups: Group[]
}
interface ActionPreviewData {
  id: string; name: string; code: string; points: number
}

export function ScoreEntry({ eventId, qrScoringMode, themeColor, eventName, eventLogoUrl }: ScoreEntryProps) {
  const accent = useMemo(() => hexToRgb(themeColor), [themeColor])

  const [participantCode, setParticipantCode] = useState('')
  const [actionCode, setActionCode] = useState('')
  const [transactions, setTransactions] = useState<PointTransactionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [celebrationRewards, setCelebrationRewards] = useState<NewlyAwardedReward[]>([])
  const [celebratingParticipantName, setCelebratingParticipantName] = useState('')

  const [participantPreview, setParticipantPreview] = useState<ParticipantPreviewData | null>(null)
  const [actionPreview, setActionPreview] = useState<ActionPreviewData | null>(null)
  const [participantLoading, setParticipantLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [flyUpPoints, setFlyUpPoints] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const [successFlash, setSuccessFlash] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)

  const scannerZoneRef = useRef<ScannerZoneRef>(null)
  const participantInputRef = useRef<HTMLInputElement>(null)
  const { submit, submitting, lastError } = useScoreSubmit(eventId)

  useEffect(() => { if (lastError) setToast({ message: lastError, variant: 'error' }) }, [lastError])

  const fetchTransactions = useCallback(async () => {
    const { data } = await supabase
      .from('point_transactions')
      .select('*, participant:participants(name, external_id), action:actions(name, code)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(20)
    setTransactions((data ?? []) as unknown as PointTransactionWithDetails[])
    setLoading(false)
  }, [eventId])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  // Participant preview debounce
  const participantDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (participantDebounceRef.current) clearTimeout(participantDebounceRef.current)
    const code = participantCode.trim()
    if (!code) { setParticipantPreview(null); return }
    participantDebounceRef.current = setTimeout(async () => {
      setParticipantLoading(true)
      try {
        const { data: participant } = await supabase
          .from('participants').select('id, name, external_id, participant_groups(group_id, groups(*))')
          .eq('event_id', eventId).eq('external_id', code).maybeSingle()
        if (!participant) { setParticipantPreview(null); setParticipantLoading(false); return }
        const groups: Group[] = ((participant.participant_groups as unknown as { group_id: string; groups: Group }[]) ?? []).map((pg) => pg.groups)
        const [pointsResult, leaderboardResult] = await Promise.all([
          supabase.from('point_transactions').select('points').eq('participant_id', participant.id),
          supabase.rpc('get_participant_leaderboard'),
        ])
        const totalPoints = (pointsResult.data ?? []).reduce((sum, t) => sum + t.points, 0)
        let rank: number | null = null
        if (leaderboardResult.data) {
          const sorted = leaderboardResult.data as { participant_id: string; total_points: number }[]
          const idx = sorted.findIndex((e) => e.participant_id === participant.id)
          if (idx >= 0) { let r = 1; for (let i = 0; i < idx; i++) { if (sorted[i].total_points > sorted[idx].total_points) r = i + 2 } rank = r }
        }
        setParticipantPreview({ id: participant.id, name: participant.name, externalId: participant.external_id, totalPoints, rank, groups })
      } catch { setParticipantPreview(null) }
      setParticipantLoading(false)
    }, 500)
    return () => { if (participantDebounceRef.current) clearTimeout(participantDebounceRef.current) }
  }, [participantCode, eventId])

  // Action preview debounce
  const actionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (actionDebounceRef.current) clearTimeout(actionDebounceRef.current)
    const code = actionCode.trim()
    if (!code) { setActionPreview(null); return }
    actionDebounceRef.current = setTimeout(async () => {
      setActionLoading(true)
      try {
        const { data: action } = await supabase.from('actions').select('id, name, code, points, is_active').eq('event_id', eventId).eq('code', code).maybeSingle()
        if (action && action.is_active) setActionPreview({ id: action.id, name: action.name, code: action.code, points: action.points })
        else setActionPreview(null)
      } catch { setActionPreview(null) }
      setActionLoading(false)
    }, 400)
    return () => { if (actionDebounceRef.current) clearTimeout(actionDebounceRef.current) }
  }, [actionCode, eventId])

  const handleSubmit = useCallback(async (pCode?: string, aCode?: string) => {
    setToast(null)
    const result = await submit(pCode ?? participantCode, aCode ?? actionCode)
    if (!result) return
    setSuccessFlash(true); setTimeout(() => setSuccessFlash(false), 1500)
    if (result.celebrationRewards.length > 0) { setCelebratingParticipantName(result.participantName); setCelebrationRewards(result.celebrationRewards) }
    setFlyUpPoints(result.points)
    const sign = result.points >= 0 ? '+' : ''
    setToast({ message: `${sign}${result.points} נק׳ ל${result.participantName} עבור ${result.actionName}`, variant: 'success' })
    setParticipantCode(''); setActionCode(''); setParticipantPreview(null); setActionPreview(null)
    scannerZoneRef.current?.resetSeparateState(); fetchTransactions()
  }, [participantCode, actionCode, submit, fetchTransactions])

  function handleFormSubmit(e: FormEvent) { e.preventDefault(); handleSubmit() }

  const bothValid = participantPreview && actionPreview

  const confettiParticles = useMemo(() => {
    if (!successFlash) return []
    return Array.from({ length: 30 }, (_, i) => ({
      id: i, x: (Math.random() - 0.5) * 400, y: -150 - Math.random() * 200,
      rotation: Math.random() * 1080 - 540,
      color: [themeColor, '#a855f7', '#22c55e', '#06b6d4', '#fbbf24', '#ec4899'][i % 6],
      size: 3 + Math.random() * 8, isCircle: Math.random() > 0.5,
    }))
  }, [successFlash, themeColor])

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-game-dark">
      <ScanBackground accent={accent} />

      {/* Full-screen success flash */}
      <AnimatePresence>
        {successFlash && (
          <motion.div className="pointer-events-none fixed inset-0 z-40"
            style={{ background: `radial-gradient(circle at 35% 50%, rgba(34,197,94,0.25) 0%, ${rgba(accent, 0.1)} 40%, transparent 70%)` }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} />
        )}
      </AnimatePresence>

      {/* Confetti burst */}
      <AnimatePresence>
        {successFlash && confettiParticles.map((p) => (
          <motion.div key={p.id} className="pointer-events-none fixed z-50"
            style={{ left: '35%', top: '45%', width: p.size, height: p.size, backgroundColor: p.color, borderRadius: p.isCircle ? '50%' : '2px' }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0 }}
            animate={{ x: p.x, y: p.y, rotate: p.rotation, opacity: 0, scale: 1 }}
            transition={{ duration: 1.4, ease: 'easeOut' }} />
        ))}
      </AnimatePresence>

      {/* ===== MAIN 60/40 LAYOUT ===== */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* LEFT 60% — Scanner */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 lg:basis-[60%]">
          {/* Title */}
          <motion.h1 className="mb-1 text-3xl font-black text-white md:text-4xl"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            סרקו ברקוד
          </motion.h1>
          <motion.p className="mb-5 text-sm text-gray-400"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            סרקו ברקוד של משימה ומשתתף כדי להעניק ניקוד
          </motion.p>

          <ScannerZone ref={scannerZoneRef} mode={qrScoringMode} successFlash={successFlash} accent={accent} />

          {/* Preview chips */}
          <AnimatePresence>
            {(participantPreview || actionPreview) && (
              <motion.div className="mt-4 flex flex-wrap items-center justify-center gap-3"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                {participantPreview && (
                  <motion.div className="flex items-center gap-2 rounded-xl px-4 py-2 backdrop-blur-sm"
                    style={{ backgroundColor: rgba(accent, 0.1), borderWidth: 1, borderColor: rgba(accent, 0.2) }}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: rgba(accent, 0.25) }}>
                      {participantPreview.name.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{participantPreview.name}</p>
                      <p className="text-[10px]" style={{ color: rgba(accent, 0.8) }}>{participantPreview.totalPoints.toLocaleString()} נק׳</p>
                    </div>
                  </motion.div>
                )}
                {actionPreview && (
                  <motion.div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 backdrop-blur-sm"
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <Zap size={14} className="text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-200">{actionPreview.name}</p>
                      <p className={`text-[10px] font-bold ${actionPreview.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {actionPreview.points >= 0 ? '+' : ''}{actionPreview.points} נק׳
                      </p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit button */}
          <AnimatePresence>
            {bothValid && (
              <motion.div className="relative mt-3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Button variant="gradient" size="lg" loading={submitting} onClick={() => handleSubmit()}
                  className="animate-glow-pulse px-8 font-bold tracking-wide">
                  <Zap size={16} className="ml-1.5" />
                  הענקת {actionPreview.points >= 0 ? '+' : ''}{actionPreview.points} נק׳
                </Button>
                <PointsFlyUp points={flyUpPoints} onDone={() => setFlyUpPoints(null)} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Manual input */}
          <motion.button className="mt-4 text-xs text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
            onClick={() => setShowManualInput(!showManualInput)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            {showManualInput ? 'הסתרת הזנה ידנית' : 'הזנה ידנית'}
          </motion.button>

          <AnimatePresence>
            {showManualInput && (
              <motion.form onSubmit={handleFormSubmit}
                className="mt-3 w-full max-w-md space-y-3 rounded-xl border border-game-border bg-game-card/60 p-4 backdrop-blur-sm"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">שחקן</label>
                    <input ref={participantInputRef} placeholder="P-1001" value={participantCode} onChange={(e) => setParticipantCode(e.target.value)}
                      className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1"
                      style={{ ['--tw-ring-color' as string]: rgba(accent, 0.5) }} />
                    {participantLoading && <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500"><div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: rgba(accent, 0.5), borderTopColor: 'transparent' }} />מחפש...</div>}
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">משימה</label>
                    <input placeholder="A-1001" value={actionCode} onChange={(e) => setActionCode(e.target.value)}
                      className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1"
                      style={{ ['--tw-ring-color' as string]: rgba(accent, 0.5) }} />
                    {actionLoading && <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500"><div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: rgba(accent, 0.5), borderTopColor: 'transparent' }} />מחפש...</div>}
                  </div>
                </div>
                <Button type="submit" variant="gradient" size="sm" loading={submitting} className="w-full font-semibold">
                  <Send size={14} className="ml-1.5" /> שלח
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

        </div>

        {/* RIGHT 40% — Recent actions feed */}
        <motion.div
          className="border-t border-game-border/20 bg-game-card/10 px-5 py-5 backdrop-blur-sm lg:basis-[40%] lg:border-l lg:border-t-0 lg:py-6 lg:pl-6 lg:pr-5"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <RecentActionsFeed
            transactions={transactions}
            loading={loading}
            accent={accent}
            eventName={eventName}
            eventLogoUrl={eventLogoUrl}
          />
        </motion.div>
      </div>

      {toast && (
        <Toast message={toast.message} variant={toast.variant}
          autoDismissMs={toast.variant === 'success' ? 3000 : undefined} onDismiss={() => setToast(null)} />
      )}
      {celebrationRewards.length > 0 && (
        <CelebrationModal rewards={celebrationRewards} participantName={celebratingParticipantName} onComplete={() => setCelebrationRewards([])} />
      )}
    </div>
  )
}
