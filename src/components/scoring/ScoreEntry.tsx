import { useState, useEffect, useCallback, useRef, FormEvent, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { hexToRgb, rgba } from '@/lib/accentColor'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { CelebrationModal } from './CelebrationModal'
import { ScannerZone } from './ScannerZone'
import type { ScannerZoneRef } from './ScannerZone'
import { RecentActionsFeed } from './RecentActionsFeed'
import { ScanBackground } from './ScanBackground'
import { AutocompleteField } from './AutocompleteField'
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
  const [participantSearching, setParticipantSearching] = useState(false)
  const [actionSearching, setActionSearching] = useState(false)
  const [participantBlurred, setParticipantBlurred] = useState(false)
  const [actionBlurred, setActionBlurred] = useState(false)

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
    if (!q) {
      setParticipantSuggestions([])
      setShowParticipantDropdown(false)
      setParticipantSearching(false)
      return
    }

    setParticipantSearching(true)
    setShowParticipantDropdown(true)

    pSearchRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('participants')
        .select('id, name, external_id')
        .eq('event_id', eventId)
        .ilike('name', `%${q}%`)
        .limit(8)
      const results: ParticipantOption[] = (data ?? []).map((p) => ({ id: p.id, name: p.name, externalId: p.external_id }))
      setParticipantSuggestions(results)
      setParticipantSearching(false)
      setShowParticipantDropdown(true)
    }, 300)

    return () => { if (pSearchRef.current) clearTimeout(pSearchRef.current) }
  }, [participantQuery, selectedParticipant, eventId])

  // Action name search
  const aSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (aSearchRef.current) clearTimeout(aSearchRef.current)
    if (selectedAction) return
    const q = actionQuery.trim()
    if (!q) {
      setActionSuggestions([])
      setShowActionDropdown(false)
      setActionSearching(false)
      return
    }

    setActionSearching(true)
    setShowActionDropdown(true)

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
      setActionSearching(false)
      setShowActionDropdown(true)
    }, 300)

    return () => { if (aSearchRef.current) clearTimeout(aSearchRef.current) }
  }, [actionQuery, selectedAction, eventId])

  function selectParticipant(p: ParticipantOption) {
    setSelectedParticipant(p)
    setParticipantQuery(p.name)
    setShowParticipantDropdown(false)
    setParticipantBlurred(false)
  }

  function clearParticipant() {
    setSelectedParticipant(null)
    setParticipantQuery('')
    setParticipantBlurred(false)
    participantInputRef.current?.focus()
  }

  function selectAction(a: ActionOption) {
    setSelectedAction(a)
    setActionQuery(a.name)
    setShowActionDropdown(false)
    setActionBlurred(false)
  }

  function clearAction() {
    setSelectedAction(null)
    setActionQuery('')
    setActionBlurred(false)
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
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 py-4 sm:py-6 lg:basis-[60%]">
          <motion.h1 className="mb-1 text-2xl font-black text-white sm:text-3xl md:text-4xl"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            תחנת ניקוד
          </motion.h1>
          <motion.p className="mb-3 max-w-sm text-center text-xs text-gray-400 sm:mb-5 sm:text-sm"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            סרקו כרטיס משימה כדי לקבל נקודות
          </motion.p>

          <div className="relative z-10 flex w-full min-h-0 shrink items-center justify-center">
            <ScannerZone ref={scannerZoneRef} mode={qrScoringMode} successFlash={successFlash} accent={accent} />
          </div>

          {/* Manual input toggle */}
          {!showManualInput && (
            <motion.button type="button"
              className="relative z-20 mt-4 shrink-0 cursor-pointer text-xs text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
              onClick={() => setShowManualInput(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              הזנה ידנית
            </motion.button>
          )}

          {/* Manual input form with autocomplete */}
          <AnimatePresence>
            {showManualInput && (
              <motion.form onSubmit={handleFormSubmit}
                className="relative mt-3 w-full max-w-lg space-y-3 overflow-visible rounded-xl border border-game-border bg-game-card/60 p-4 backdrop-blur-sm"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="absolute left-3 top-3 rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
                  aria-label="סגירת הזנה ידנית"
                >
                  <X size={16} />
                </button>
                <div className="flex items-end gap-3 overflow-visible">
                  <div className="grid min-w-0 flex-1 gap-3 overflow-visible sm:grid-cols-2">
                  <AutocompleteField
                    label="שחקן"
                    placeholder="הקלידו שם משתתף..."
                    query={participantQuery}
                    onQueryChange={(value) => {
                      setParticipantQuery(value)
                      setSelectedParticipant(null)
                      setParticipantBlurred(false)
                    }}
                    selected={selectedParticipant}
                    onSelect={selectParticipant}
                    onClear={clearParticipant}
                    suggestions={participantSuggestions}
                    searching={participantSearching}
                    showDropdown={showParticipantDropdown}
                    onShowDropdown={setShowParticipantDropdown}
                    blurred={participantBlurred}
                    onBlurred={() => setParticipantBlurred(true)}
                    accent={accent}
                    dropdownRef={participantDropdownRef}
                    inputRef={participantInputRef}
                    getKey={(p) => p.id}
                    renderSelected={(p) => (
                      <span className="truncate text-sm font-medium text-white">{p.name}</span>
                    )}
                    renderOption={(p) => (
                      <>
                        <div
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ backgroundColor: rgba(accent, 0.2) }}
                        >
                          {p.name.slice(0, 2)}
                        </div>
                        <span className="truncate">{p.name}</span>
                        <span className="mr-auto font-mono text-[10px] text-gray-500">{p.externalId}</span>
                      </>
                    )}
                  />

                  <AutocompleteField
                    label="משימה"
                    placeholder="הקלידו שם משימה..."
                    query={actionQuery}
                    onQueryChange={(value) => {
                      setActionQuery(value)
                      setSelectedAction(null)
                      setActionBlurred(false)
                    }}
                    selected={selectedAction}
                    onSelect={selectAction}
                    onClear={clearAction}
                    suggestions={actionSuggestions}
                    searching={actionSearching}
                    showDropdown={showActionDropdown}
                    onShowDropdown={setShowActionDropdown}
                    blurred={actionBlurred}
                    onBlurred={() => setActionBlurred(true)}
                    accent={accent}
                    dropdownRef={actionDropdownRef}
                    getKey={(a) => a.id}
                    renderSelected={(a) => (
                      <>
                        <span className="truncate text-sm font-medium text-white">{a.name}</span>
                        <span className={`text-[10px] font-bold ${a.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {a.points >= 0 ? '+' : ''}{a.points}
                        </span>
                      </>
                    )}
                    renderOption={(a) => (
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate">{a.name}</span>
                        <span className={`shrink-0 text-xs font-bold ${a.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {a.points >= 0 ? '+' : ''}{a.points}
                        </span>
                      </div>
                    )}
                  />
                  </div>
                  <Button
                    type="submit"
                    variant="gradient"
                    size="md"
                    loading={submitting}
                    disabled={!bothValid}
                    aria-label="שליחה"
                    className="h-10 w-10 shrink-0 p-0"
                  >
                    <Send size={18} />
                  </Button>
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
          size={toast.variant === 'success' ? 'large' : 'default'}
          autoDismissMs={toast.variant === 'success' ? 3000 : undefined} onDismiss={() => setToast(null)} />
      )}
      {celebrationRewards.length > 0 && (
        <CelebrationModal rewards={celebrationRewards} participantName={celebratingParticipantName} onComplete={() => setCelebrationRewards([])} />
      )}
    </div>
  )
}
