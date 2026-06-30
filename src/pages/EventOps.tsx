import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useScoreSubmit } from '@/hooks/useScoreSubmit'
import { useOperationsData } from '@/hooks/useOperationsData'
import { useOpsSound } from '@/hooks/useOpsSound'
import { usePlanPermissions } from '@/hooks/usePlanPermissions'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { Toast } from '@/components/ui/Toast'
import { CelebrationModal } from '@/components/scoring/CelebrationModal'
import { ScannerZone } from '@/components/scoring/ScannerZone'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import { useHebrewKeyboardWarning } from '@/hooks/useHebrewKeyboardWarning'
import { parseQrPayload } from '@/lib/qrPayload'
import { looksLikeHebrewLayoutScan } from '@/lib/keyboardLayout'
import { MissionIntelPanel } from '@/components/ops/MissionIntelPanel'
import { LiveActivityFeed } from '@/components/ops/LiveActivityFeed'
import type { LatestScoreInfo } from '@/components/ops/LiveActivityFeed'
import { ManualEntryForm } from '@/components/ops/ManualEntryForm'
import { OpsLeaderboard } from '@/components/ops/OpsLeaderboard'
import { MissionSpotlight } from '@/components/ops/MissionSpotlight'
import { ConfirmationBanner } from '@/components/ops/ConfirmationBanner'
import type { ConfirmationData } from '@/components/ops/ConfirmationBanner'
import { ScoreCelebrationOverlay } from '@/components/ops/ScoreCelebrationOverlay'
import type { CelebrationOverlayData } from '@/components/ops/ScoreCelebrationOverlay'
import { hexToRgb, rgba } from '@/lib/accentColor'
import type { Event, NewlyAwardedReward } from '@/types'

export function EventOpsPage() {
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

  if (loading || !event) return <FullPageLoader />
  return <EventOpsContent event={event} />
}


function EventOpsContent({ event }: { event: Event }) {
  const navigate = useNavigate()
  const accent = useMemo(() => hexToRgb('#7c3aed'), [])
  const opsData = useOperationsData(event.id)
  const { submit, submitting, lastError } = useScoreSubmit(event.id)
  const opsSound = useOpsSound()
  const { canScanQR } = usePlanPermissions()

  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const [celebrationRewards, setCelebrationRewards] = useState<NewlyAwardedReward[]>([])
  const [celebratingParticipantName, setCelebratingParticipantName] = useState('')
  const [successFlash, setSuccessFlash] = useState(false)
  const [successPulse, setSuccessPulse] = useState(false)
  const [titlePulse, setTitlePulse] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null)
  const [celebrationOverlay, setCelebrationOverlay] = useState<CelebrationOverlayData | null>(null)
  const [latestScore, setLatestScore] = useState<LatestScoreInfo | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)

  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { pendingTimers.current.forEach(clearTimeout) }, [])

  useEffect(() => {
    if (lastError) setToast({ message: lastError, variant: 'error' })
  }, [lastError])

  const handleSubmit = useCallback(async (participantCode: string, actionCode: string) => {
    setToast(null)
    const result = await submit(participantCode, actionCode)
    if (!result) return

    // Immediate refresh — leaderboard re-ranks
    opsData.refresh()

    // Global screen pulse
    setSuccessPulse(true)
    pendingTimers.current.push(setTimeout(() => setSuccessPulse(false), 600))

    // Scanner flash
    setSuccessFlash(true)
    pendingTimers.current.push(setTimeout(() => setSuccessFlash(false), 1500))

    // Leaderboard title bounce
    setTitlePulse(true)
    pendingTimers.current.push(setTimeout(() => setTitlePulse(false), 400))

    // Feed card for Live Activity Feed
    setLatestScore({
      id: Date.now().toString(),
      name: result.participantName,
      points: result.points,
      bonus: result.speedBonusApplied,
      mult: result.speedBonusLabel,
    })

    // Full-screen celebration overlay (1.2s auto-dismiss)
    const overlayData: CelebrationOverlayData = {
      name: result.participantName,
      points: result.points,
      bonus: result.speedBonusApplied,
      mult: result.speedBonusLabel,
    }
    setCelebrationOverlay(overlayData)
    pendingTimers.current.push(setTimeout(() => setCelebrationOverlay(null), 1200))

    // Secondary confirmation banner (1.5s)
    setConfirmation({
      name: result.participantName,
      points: result.points,
      bonus: result.speedBonusApplied,
      mult: result.speedBonusLabel,
    })
    pendingTimers.current.push(setTimeout(() => setConfirmation(null), 1500))

    // Sound
    opsSound.play(result.speedBonusApplied ? 'bonus_score' : 'score')

    // Celebration modal for reward milestones
    if (result.celebrationRewards.length > 0) {
      setCelebratingParticipantName(result.participantName)
      setCelebrationRewards(result.celebrationRewards)
    }
  }, [submit, opsData, opsSound])

  const handleQrScan = useCallback(({ participantCode, actionCode }: { participantCode?: string; actionCode?: string }) => {
    if (participantCode && actionCode) handleSubmit(participantCode, actionCode)
  }, [handleSubmit])

  const keyboardWarningEnabled = !opsData.loading
  const { showWarning: hebrewKeyboardWarning, flagHebrewInText, onScanStart } = useHebrewKeyboardWarning(keyboardWarningEnabled)
  const hebrewKeyboardWarningRef = useRef(hebrewKeyboardWarning)
  hebrewKeyboardWarningRef.current = hebrewKeyboardWarning

  const scannerEnabled = canScanQR && !showManualEntry && !opsData.loading && !submitting

  const handleRawScan = useCallback((raw: string) => {
    const parsed = parseQrPayload(raw)
    if (parsed.ok) {
      handleQrScan(parsed.data)
      return
    }

    const hebrewLayout =
      hebrewKeyboardWarningRef.current ||
      looksLikeHebrewLayoutScan(raw)

    if (hebrewLayout) {
      flagHebrewInText(raw)
      return
    }

    setToast({ message: parsed.error, variant: 'error' })
  }, [handleQrScan, flagHebrewInText])

  const scannerInputRef = useHardwareScanner(scannerEnabled, handleRawScan, onScanStart)

  if (opsData.loading) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3" style={{ background: '#0a0814' }}>
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
      <p className="text-sm text-gray-500">טוען מסוף מבצעים...</p>
    </div>
  )

  return (
    <div className="relative flex h-screen flex-col overflow-hidden" style={{ background: '#0a0814', direction: 'rtl' }}>

      {/* Global background glow pulse on score */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        animate={{ opacity: successPulse ? 0.12 : 0 }}
        transition={{ duration: successPulse ? 0.15 : 0.45 }}
        style={{ background: `radial-gradient(circle at center, ${rgba(accent, 1)}, transparent 70%)` }} />

      {/* ═══ HEADER ═══ */}
      <div className="relative z-10 shrink-0 border-b px-4 py-2.5 flex items-center gap-3"
        style={{ borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        {/* Event info */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {event.logo_url && (
            <img src={event.logo_url} className="h-7 w-7 rounded-lg object-cover shrink-0" alt="" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-black text-white truncate leading-none">{event.name}</p>
            <p className="text-[10px] text-gray-500 leading-none mt-0.5">התחרות</p>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={() => navigate(`/events/${event.id}/control`)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 transition-all hover:bg-white/[0.07] hover:text-white">
          <ArrowRight size={12} />
          <span className="hidden sm:inline">חזרה</span>
        </button>
      </div>

      {hebrewKeyboardWarning && (
        <div
          role="alert"
          className="relative z-20 shrink-0 border-b border-amber-500/40 bg-amber-600/25 px-4 py-2.5"
        >
          <p className="text-center text-sm font-semibold text-amber-50">
            המקלדת מוגדרת על עברית — עברו ל-<span className="font-black underline">ENG</span> לפני סריקה
          </p>
        </div>
      )}

      {/* ═══ BODY — 3 COLUMNS ═══ */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* Column 1 — Live Activity Feed (rightmost in RTL) */}
        <div className="hidden lg:flex w-[28%] border-l flex-col p-4 shrink-0 overflow-hidden"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <LiveActivityFeed
            rankedGroups={opsData.rankedGroups}
            transactions={opsData.transactions}
            sortedMissions={opsData.sortedMissions}
            bonusMissions={opsData.bonusMissions}
            secondNow={opsData.secondNow}
            accent={accent}
            latestScore={latestScore} />
        </div>

        {/* Column 2 — Scanner (center) */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-3 gap-3 border-l"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

          {/* Mobile mission intel (visible only on < lg) */}
          <div className="lg:hidden w-full max-w-sm">
            <MissionIntelPanel
              primaryMission={opsData.primaryMission}
              bonusMissions={opsData.bonusMissions}
              sortedMissions={opsData.sortedMissions}
              secondNow={opsData.secondNow} />
          </div>

          {/* Scanner zone — QR-enabled plans only */}
          {canScanQR && (
            <div className="relative w-full shrink-0">
              <ScannerZone
                successFlash={successFlash}
                processing={submitting}
                accent={accent} />
              <input
                ref={scannerInputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label="קלט סורק QR"
                className="sr-only"
              />
            </div>
          )}

          {/* Confirmation banner (secondary) */}
          <AnimatePresence>
            {confirmation && (
              <ConfirmationBanner key="confirmation-banner" confirmation={confirmation} accent={accent} />
            )}
          </AnimatePresence>

          {/* Manual entry */}
          {canScanQR ? (
            <>
              {!showManualEntry && (
                <button
                  type="button"
                  className="shrink-0 text-xs text-gray-500 underline-offset-2 transition-colors hover:text-gray-300 hover:underline"
                  onClick={() => setShowManualEntry(true)}
                >
                  הזנה ידנית
                </button>
              )}
              <AnimatePresence>
                {showManualEntry && (
                  <motion.div
                    key="manual-entry"
                    className="relative w-full max-w-sm shrink-0"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowManualEntry(false)}
                      className="absolute left-3 top-3 z-10 rounded p-0.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="סגור"
                    >
                      <X size={14} />
                    </button>
                    <ManualEntryForm
                      eventId={event.id}
                      accent={accent}
                      bonusMissions={opsData.bonusMissions}
                      submitting={submitting}
                      onSubmit={handleSubmit} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="w-full max-w-sm shrink-0">
              <ManualEntryForm
                eventId={event.id}
                accent={accent}
                bonusMissions={opsData.bonusMissions}
                submitting={submitting}
                onSubmit={handleSubmit} />
            </div>
          )}

          {/* Mobile leaderboard (visible only on < lg) */}
          <div className="lg:hidden w-full max-w-sm pb-4">
            <OpsLeaderboard rankedGroups={opsData.rankedGroups} titlePulse={titlePulse} />
          </div>
        </div>

        {/* Column 3 — Mission Spotlight (leftmost in RTL) */}
        <div className="hidden lg:flex w-[28%] flex-col p-4 shrink-0 overflow-hidden">
          <MissionSpotlight
            sortedMissions={opsData.sortedMissions}
            bonusMissions={opsData.bonusMissions}
            rankedGroups={opsData.rankedGroups}
            secondNow={opsData.secondNow}
            accent={accent} />
        </div>
      </div>

      {/* ═══ OVERLAYS ═══ */}

      {/* Full-screen celebration overlay */}
      <AnimatePresence>
        {celebrationOverlay && (
          <ScoreCelebrationOverlay
            key="score-celebration"
            {...celebrationOverlay}
            accent={accent}
            onDismiss={() => setCelebrationOverlay(null)} />
        )}
      </AnimatePresence>

      {/* Reward milestone modal */}
      {celebrationRewards.length > 0 && (
        <CelebrationModal
          rewards={celebrationRewards}
          participantName={celebratingParticipantName}
          onComplete={() => { setCelebrationRewards([]); setCelebratingParticipantName('') }} />
      )}

      {/* Error toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            variant={toast.variant}
            onDismiss={() => setToast(null)}
            autoDismissMs={4000} />
        )}
      </AnimatePresence>
    </div>
  )
}
