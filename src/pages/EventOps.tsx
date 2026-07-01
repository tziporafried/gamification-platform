import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Lock, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useScoreSubmit } from '@/hooks/useScoreSubmit'
import { useOperationsData } from '@/hooks/useOperationsData'
import { useEventCatalog } from '@/hooks/useEventCatalog'
import { useOpsSound } from '@/hooks/useOpsSound'
import { usePlanPermissions } from '@/hooks/usePlanPermissions'
import { useAuth } from '@/contexts/AuthContext'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import { Toast } from '@/components/ui/Toast'
import { CelebrationModal } from '@/components/scoring/CelebrationModal'
import { ScannerZone } from '@/components/scoring/ScannerZone'
import { useHardwareScanner } from '@/hooks/useHardwareScanner'
import { useHebrewKeyboardWarning } from '@/hooks/useHebrewKeyboardWarning'
import { parseQrPayload } from '@/lib/qrPayload'
import { looksLikeHebrewLayoutScan } from '@/lib/keyboardLayout'
import { ManualEntryForm } from '@/components/ops/ManualEntryForm'
import { ConfirmationBanner } from '@/components/ops/ConfirmationBanner'
import { CompetitionPanel } from '@/components/ops/CompetitionPanel'
import { HeroCard } from '@/components/ops/HeroCard'
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
  const { isSuperAdmin } = useAuth()
  const accent = useMemo(() => {
    const primary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
    return hexToRgb(primary)
  }, [])
  const opsData = useOperationsData(event.id)
  const catalog = useEventCatalog(event.id)
  const { submit, submitting, lastError } = useScoreSubmit(event.id)
  const opsSound = useOpsSound()
  const { canScanQR, showLockedScanner } = usePlanPermissions(isSuperAdmin ? 'full' : event.plan)

  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const [celebrationRewards, setCelebrationRewards] = useState<NewlyAwardedReward[]>([])
  const [celebratingParticipantName, setCelebratingParticipantName] = useState('')
  const [successFlash, setSuccessFlash] = useState(false)
  const [successPulse, setSuccessPulse] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null)
  const [celebrationOverlay, setCelebrationOverlay] = useState<CelebrationOverlayData | null>(null)
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

    opsData.applyScore({
      participantId: result.participantId,
      participantName: result.participantName,
      participantExternalId: result.participantExternalId,
      participantGroupIds: result.participantGroupIds,
      actionId: result.actionId,
      actionName: result.actionName,
      actionCode: result.actionCode,
      actionBasePoints: result.basePoints,
      points: result.points,
    })

    // Global screen pulse
    setSuccessPulse(true)
    pendingTimers.current.push(setTimeout(() => setSuccessPulse(false), 600))

    // Scanner flash
    setSuccessFlash(true)
    pendingTimers.current.push(setTimeout(() => setSuccessFlash(false), 1500))

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

  const keyboardWarningEnabled = !opsData.loading
  const { showWarning: hebrewKeyboardWarning, flagHebrewInText, onScanStart } = useHebrewKeyboardWarning(keyboardWarningEnabled)
  const hebrewKeyboardWarningRef = useRef(hebrewKeyboardWarning)
  hebrewKeyboardWarningRef.current = hebrewKeyboardWarning

  const scannerEnabled = canScanQR && !showManualEntry && !opsData.loading && !submitting

  const handleRawScan = useCallback((raw: string) => {
    const parsed = parseQrPayload(raw)
    if (parsed.ok) {
      handleSubmit(parsed.data.participantCode, parsed.data.actionCode)
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
  }, [handleSubmit, flagHebrewInText])

  const scannerInputRef = useHardwareScanner(scannerEnabled, handleRawScan, onScanStart)

  if (opsData.loading) return (
    <div className={cn('flex min-h-screen flex-col items-center justify-center gap-3', theme.pageBg)}>
      <Spinner size="lg" className="border-tertiary" />
      <p className={cn('text-sm', theme.textSubtle)}>טוען מסוף מבצעים...</p>
    </div>
  )

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-app-radial" dir="rtl">

      {/* Global background glow pulse on score */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        animate={{ opacity: successPulse ? 0.12 : 0 }}
        transition={{ duration: successPulse ? 0.15 : 0.45 }}
        style={{ background: `radial-gradient(circle at center, ${rgba(accent, 1)}, transparent 70%)` }} />

      {/* ═══ HEADER ═══ */}
      <div className="relative z-10 shrink-0 border-b border-border bg-surface px-4 py-2.5 flex items-center gap-3">
        {/* Event info */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {event.logo_url && (
            <img src={event.logo_url} className="h-7 w-7 rounded-lg object-cover shrink-0" alt="" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-black text-foreground truncate leading-none">{event.name}</p>
            <p className="text-[10px] text-muted leading-none mt-0.5">התחרות</p>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={() => navigate(`/events/${event.id}/control`)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-muted transition-all hover:bg-surface-elevated hover:text-foreground">
          <ArrowRight size={12} />
          <span className="hidden sm:inline">חזרה</span>
        </button>
      </div>

      {hebrewKeyboardWarning && (
        <div
          role="alert"
          className="relative z-20 shrink-0 border-b border-warning bg-surface-elevated px-4 py-2.5"
        >
          <p className="text-center text-sm font-semibold text-warning">
            המקלדת מוגדרת על עברית — עברו ל-<span className="font-black underline">ENG</span> לפני סריקה
          </p>
        </div>
      )}

      {/* ═══ BODY — 3 COLUMNS ═══ */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* Column 1 — Hero Card: what's happening now (rightmost in RTL) */}
        <div className="hidden lg:flex w-[28%] border-l border-border flex-col p-5 shrink-0 overflow-hidden">
          <HeroCard
            sortedMissions={opsData.sortedMissions}
            bonusMissions={opsData.bonusMissions}
            transactions={opsData.transactions}
            rankedGroups={opsData.rankedGroups}
            secondNow={opsData.secondNow}
            accent={accent} />
        </div>

        {/* Column 2 — Scanner (center) */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-3 gap-3 border-l border-border">

          {/* Scanner zone — QR plans: active; free: locked overlay; independent: hidden */}
          {(canScanQR || showLockedScanner) && (
            <div className="relative w-full shrink-0">
              <ScannerZone
                successFlash={successFlash}
                processing={submitting}
                accent={accent} />
              {canScanQR && (
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
              )}
              {showLockedScanner && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl sm:rounded-3xl backdrop-blur-sm bg-black/60">
                  <Lock size={36} className="text-muted" />
                  <p className="text-center text-sm font-semibold text-muted px-4">סריקת QR זמינה מתוכנית עצמאי ומעלה</p>
                </div>
              )}
            </div>
          )}

          {/* Confirmation banner (secondary) */}
          <AnimatePresence>
            {confirmation && (
              <ConfirmationBanner key="confirmation-banner" confirmation={confirmation} accent={accent} />
            )}
          </AnimatePresence>

          {/* Manual entry — full/org: minimized; free/independent: always visible */}
          {canScanQR ? (
            <>
              {!showManualEntry && (
                <button
                  type="button"
                  className="shrink-0 text-xs text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  onClick={() => setShowManualEntry(true)}
                >
                  הזנה ידנית
                </button>
              )}
              <div className={showManualEntry ? 'relative w-full max-w-sm shrink-0' : 'hidden'} aria-hidden={!showManualEntry}>
                {showManualEntry && (
                  <button
                    type="button"
                    onClick={() => setShowManualEntry(false)}
                    className="absolute left-3 top-3 z-10 rounded p-0.5 text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
                    aria-label="סגור"
                  >
                    <X size={14} />
                  </button>
                )}
                <ManualEntryForm
                  eventId={event.id}
                  accent={accent}
                  bonusMissions={opsData.bonusMissions}
                  submitting={submitting}
                  catalog={catalog}
                  onSubmit={handleSubmit} />
              </div>
            </>
          ) : (
            <div className="w-full max-w-sm shrink-0">
              <ManualEntryForm
                eventId={event.id}
                accent={accent}
                bonusMissions={opsData.bonusMissions}
                submitting={submitting}
                catalog={catalog}
                onSubmit={handleSubmit} />
            </div>
          )}

          {/* Mobile competition panel (visible only on < lg) */}
          <div className="lg:hidden w-full max-w-sm pb-4" style={{ height: 320 }}>
            <CompetitionPanel
              rankedGroups={opsData.rankedGroups}
              transactions={opsData.transactions}
              accent={accent} />
          </div>
        </div>

        {/* Column 3 — Competition Panel: who's winning (leftmost in RTL) */}
        <div className="hidden lg:flex w-[28%] flex-col p-5 shrink-0 overflow-hidden">
          <CompetitionPanel
            rankedGroups={opsData.rankedGroups}
            transactions={opsData.transactions}
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
