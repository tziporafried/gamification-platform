import { useState, useEffect, useCallback, useRef, FormEvent, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { hexToRgb, rgba } from '@/lib/accentColor'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { CelebrationModal } from './CelebrationModal'
import { ScannerZone } from './ScannerZone'
import type { ScannerZoneRef } from './ScannerZone'
import { RecentActionsFeed } from './RecentActionsFeed'
import { ScanBackground } from './ScanBackground'
import { useScoreSubmit } from '@/hooks/useScoreSubmit'
import type { PointTransactionWithDetails, NewlyAwardedReward, QrScoringMode } from '@/types'

interface ScoreEntryProps {
  eventId: string
  qrScoringMode: QrScoringMode
  themeColor: string
  eventName: string
  eventLogoUrl: string | null
}

interface ParticipantOption { id: string; name: string; externalId: string }
interface ActionOption { id: string; name: string; code: string; points: number }

export function ScoreEntry({ eventId, qrScoringMode, themeColor, eventName, eventLogoUrl }: ScoreEntryProps) {
  const accent = useMemo(() => hexToRgb(themeColor), [themeColor])

  const [transactions, setTransactions] = useState<PointTransactionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [celebrationRewards, setCelebrationRewards] = useState<NewlyAwardedReward[]>([])
  const [celebratingParticipantName, setCelebratingParticipantName] = useState('')

  // Manual input — name-based autocomplete
  const [participantQuery, setParticipantQuery] = useState('')
  const [actionQuery, setActionQuery] = useState('')
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantOption | null>(null)
  const [selectedAction, setSelectedAction] = useState<ActionOption | null>(null)
  const [participantSuggestions, setParticipantSuggestions] = useState<ParticipantOption[]>([])
  const [actionSuggestions, setActionSuggestions] = useState<ActionOption[]>([])
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false)
  const [showActionDropdown, setShowActionDropdown] = useState(false)

  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const [successFlash, setSuccessFlash] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)

  const scannerZoneRef = useRef<ScannerZoneRef>(null)
  const participantInputRef = useRef<HTMLInputElement>(null)
  const participantDropdownRef = useRef<HTMLDivElement>(null)
  const actionDropdownRef = useRef<HTMLDivElement>(null)
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

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (participantDropdownRef.current && !participantDropdownRef.current.contains(e.target as Node)) {
        setShowParticipantDropdown(false)
      }
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target as Node)) {
        setShowActionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Participant name search
  const pSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (pSearchRef.current) clearTimeout(pSearchRef.current)
    if (selectedParticipant) return
    const q = participantQuery.trim()
    if (!q) { setParticipantSuggestions([]); setShowParticipantDropdown(false); return }

    pSearchRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('participants')
        .select('id, name, external_id')
        .eq('event_id', eventId)
        .ilike('name', `%${q}%`)
        .limit(8)
      const results: ParticipantOption[] = (data ?? []).map((p) => ({ id: p.id, name: p.name, externalId: p.external_id }))
      setParticipantSuggestions(results)
      setShowParticipantDropdown(results.length > 0)
    }, 300)

    return () => { if (pSearchRef.current) clearTimeout(pSearchRef.current) }
  }, [participantQuery, selectedParticipant, eventId])

  // Action name search
  const aSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (aSearchRef.current) clearTimeout(aSearchRef.current)
    if (selectedAction) return
    const q = actionQuery.trim()
    if (!q) { setActionSuggestions([]); setShowActionDropdown(false); return }

    aSearchRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('actions')
        .select('id, name, code, points, is_active')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .ilike('name', `%${q}%`)
        .limit(8)
      const results: ActionOption[] = (data ?? []).map((a) => ({ id: a.id, name: a.name, code: a.code, points: a.points }))
      setActionSuggestions(results)
      setShowActionDropdown(results.length > 0)
    }, 300)

    return () => { if (aSearchRef.current) clearTimeout(aSearchRef.current) }
  }, [actionQuery, selectedAction, eventId])

  function selectParticipant(p: ParticipantOption) {
    setSelectedParticipant(p)
    setParticipantQuery(p.name)
    setShowParticipantDropdown(false)
  }

  function clearParticipant() {
    setSelectedParticipant(null)
    setParticipantQuery('')
    participantInputRef.current?.focus()
  }

  function selectAction(a: ActionOption) {
    setSelectedAction(a)
    setActionQuery(a.name)
    setShowActionDropdown(false)
  }

  function clearAction() {
    setSelectedAction(null)
    setActionQuery('')
  }

  const handleSubmit = useCallback(async () => {
    setToast(null)
    if (!selectedParticipant || !selectedAction) {
      setToast({ message: 'יש לבחור משתתף ומשימה', variant: 'error' })
      return
    }
    const result = await submit(selectedParticipant.externalId, selectedAction.code)
    if (!result) return
    setSuccessFlash(true); setTimeout(() => setSuccessFlash(false), 1500)
    if (result.celebrationRewards.length > 0) { setCelebratingParticipantName(result.participantName); setCelebrationRewards(result.celebrationRewards) }
    const sign = result.points >= 0 ? '+' : ''
    setToast({ message: `${sign}${result.points} נק׳ ל${result.participantName} עבור ${result.actionName}`, variant: 'success' })
    setSelectedParticipant(null); setParticipantQuery('')
    setSelectedAction(null); setActionQuery('')
    scannerZoneRef.current?.resetSeparateState(); fetchTransactions()
  }, [selectedParticipant, selectedAction, submit, fetchTransactions])

  function handleFormSubmit(e: FormEvent) { e.preventDefault(); handleSubmit() }

  const bothValid = selectedParticipant && selectedAction

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
          <motion.h1 className="mb-1 text-3xl font-black text-white md:text-4xl"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            סרקו ברקוד
          </motion.h1>
          <motion.p className="mb-5 text-sm text-gray-400"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            סרקו ברקוד של משימה ומשתתף כדי להעניק ניקוד
          </motion.p>

          <ScannerZone ref={scannerZoneRef} mode={qrScoringMode} successFlash={successFlash} accent={accent} />

          {/* Submit button */}
          <AnimatePresence>
            {bothValid && (
              <motion.div className="relative mt-3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Button variant="gradient" size="lg" loading={submitting} onClick={handleSubmit}
                  className="animate-glow-pulse px-8 font-bold tracking-wide">
                  <Zap size={16} className="ml-1.5" />
                  הענקת {selectedAction.points >= 0 ? '+' : ''}{selectedAction.points} נק׳
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Manual input toggle */}
          <motion.button className="mt-4 text-xs text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
            onClick={() => setShowManualInput(!showManualInput)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            {showManualInput ? 'הסתרת הזנה ידנית' : 'הזנה ידנית'}
          </motion.button>

          {/* Manual input form with autocomplete */}
          <AnimatePresence>
            {showManualInput && (
              <motion.form onSubmit={handleFormSubmit}
                className="mt-3 w-full max-w-md space-y-3 rounded-xl border border-game-border bg-game-card/60 p-4 backdrop-blur-sm"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Participant autocomplete */}
                  <div className="relative" ref={participantDropdownRef}>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">שחקן</label>
                    {selectedParticipant ? (
                      <div className="flex items-center justify-between rounded-lg border bg-game-dark px-3 py-2"
                        style={{ borderColor: rgba(accent, 0.3) }}>
                        <span className="text-sm font-medium text-white">{selectedParticipant.name}</span>
                        <button type="button" onClick={clearParticipant} className="mr-1 rounded p-0.5 text-gray-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <input
                        ref={participantInputRef}
                        placeholder="הקלידו שם משתתף..."
                        value={participantQuery}
                        onChange={(e) => { setParticipantQuery(e.target.value); setSelectedParticipant(null) }}
                        onFocus={() => { if (participantSuggestions.length > 0) setShowParticipantDropdown(true) }}
                        className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1"
                        style={{ ['--tw-ring-color' as string]: rgba(accent, 0.5) }}
                      />
                    )}
                    {showParticipantDropdown && participantSuggestions.length > 0 && (
                      <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-game-border bg-game-dark shadow-xl">
                        {participantSuggestions.map((p) => (
                          <button key={p.id} type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm text-gray-200 transition-colors hover:bg-white/5"
                            onClick={() => selectParticipant(p)}>
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                              style={{ backgroundColor: rgba(accent, 0.2) }}>
                              {p.name.slice(0, 2)}
                            </div>
                            <span className="truncate">{p.name}</span>
                            <span className="mr-auto font-mono text-[10px] text-gray-500">{p.externalId}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action autocomplete */}
                  <div className="relative" ref={actionDropdownRef}>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">משימה</label>
                    {selectedAction ? (
                      <div className="flex items-center justify-between rounded-lg border bg-game-dark px-3 py-2"
                        style={{ borderColor: rgba(accent, 0.3) }}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{selectedAction.name}</span>
                          <span className={`text-[10px] font-bold ${selectedAction.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {selectedAction.points >= 0 ? '+' : ''}{selectedAction.points}
                          </span>
                        </div>
                        <button type="button" onClick={clearAction} className="mr-1 rounded p-0.5 text-gray-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <input
                        placeholder="הקלידו שם משימה..."
                        value={actionQuery}
                        onChange={(e) => { setActionQuery(e.target.value); setSelectedAction(null) }}
                        onFocus={() => { if (actionSuggestions.length > 0) setShowActionDropdown(true) }}
                        className="w-full rounded-lg border border-game-border bg-game-dark px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1"
                        style={{ ['--tw-ring-color' as string]: rgba(accent, 0.5) }}
                      />
                    )}
                    {showActionDropdown && actionSuggestions.length > 0 && (
                      <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-game-border bg-game-dark shadow-xl">
                        {actionSuggestions.map((a) => (
                          <button key={a.id} type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-right text-sm text-gray-200 transition-colors hover:bg-white/5"
                            onClick={() => selectAction(a)}>
                            <span className="truncate">{a.name}</span>
                            <span className={`shrink-0 text-xs font-bold ${a.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {a.points >= 0 ? '+' : ''}{a.points}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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
