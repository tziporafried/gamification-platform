import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { ScreenControls } from '@/components/ui/ScreenControls'
import { supabase } from '@/lib/supabase'
import { canRunLottery, usePlanPermissions } from '@/hooks/usePlanPermissions'
import { EventFeaturesProvider, useFeatureFlagState } from '@/contexts/EventFeaturesContext'
import type { UserPlan } from '@/types'
import { LotteryBroadcastLayout } from '@/components/live-events/lottery/LotteryBroadcastLayout'
import { LotteryConfigurationCard } from '@/components/live-events/lottery/LotteryConfigurationCard'
import { LotteryPreparingStage } from '@/components/live-events/lottery/LotteryPreparingStage'
import { LotteryPresentation } from '@/components/live-events/lottery/LotteryPresentation'
import { SCAN_BASED_LOTTERY_FLAG } from '@/components/live-events/lottery/lotteryMode'
import {
  clearLotterySession,
  loadLotterySession,
  saveLotterySession,
  type LotterySessionPayload,
} from '@/components/live-events/lottery/lotterySession'

/**
 * Broadcast-ready lottery tab - no AppShell / GlobalHeader.
 * Permanent stage + dock layout; only stage/dock content changes per state.
 * Open to any event owner on a plan that includes the lottery; trial-plan
 * events run the full ceremony but mask the winner's identity (see
 * LotteryPresentation) instead of blocking access. The basic plan is locked
 * out here too, not just in the launcher, so the URL can't be shared into it.
 *
 * This outer half exists only to resolve the game's plan and its feature
 * flags, because the `scan_based_lottery` flag decides which lottery the dock
 * below is setting up and the flag gate has to sit inside a provider. The plan
 * check itself is unchanged and still runs before anything else.
 */
export function LotteryPresentationPage() {
  const { id } = useParams<{ id: string }>()
  const [plan, setPlan] = useState<UserPlan | null | undefined>(undefined)
  // `status` is read for the same reason the kiosk reads it: a game that has
  // not started does not take scans, and the scan lottery collects by scanning.
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setPlan(null)
      return
    }
    let cancelled = false
    supabase
      .from('events')
      .select('plan, status')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setPlan((data?.plan as UserPlan | undefined) ?? null)
        setStatus((data?.status as string | undefined) ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (plan === undefined) {
    return <FullPageLoader />
  }

  return (
    <EventFeaturesProvider eventId={id} plan={plan ?? undefined}>
      <LotteryBroadcast eventId={id} plan={plan} status={status} />
    </EventFeaturesProvider>
  )
}

interface LotteryBroadcastProps {
  eventId: string | undefined
  plan: UserPlan | null
  status: string | null
}

function LotteryBroadcast({ eventId: id, plan, status }: LotteryBroadcastProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const runId = searchParams.get('run') ?? ''
  const [session, setSession] = useState<LotterySessionPayload | null | undefined>(
    runId ? undefined : null,
  )

  // The flag adds the scan lottery to what this dock offers; it never replaces
  // the points lottery. Which of the two runs is the organizer's choice below.
  const { on: scanLotteryAvailable, loading: flagLoading } =
    useFeatureFlagState(SCAN_BASED_LOTTERY_FLAG)

  const isTrial = plan === 'free'
  const locked = plan != null && !canRunLottery(plan)

  // Scanning from the lottery stage answers to the kiosk's two gates, not to
  // new ones: the game has to be running, and the plan has to include
  // scanning. Every plan that may run a lottery may scan today, so this only
  // matters if those lists ever diverge - which is exactly when a silent
  // assumption would have become a hole.
  const { canScanQR } = usePlanPermissions(plan ?? 'free')
  const gameStarted = status === 'active'
  const scanningAllowed = canScanQR && gameStarted
  const scanningBlockedReason = !gameStarted
    ? 'המשחק עדיין לא פעיל - הפעילו אותו כדי לסרוק.'
    : 'הסריקה אינה כלולה במסלול הזה.'

  useEffect(() => {
    if (!runId) {
      setSession(null)
      return
    }
    if (!id) {
      setSession(null)
      return
    }
    const loaded = loadLotterySession(runId)
    if (!loaded || loaded.config.eventId !== id) {
      setSession(null)
      return
    }
    setSession(loaded)
  }, [id, runId])

  // The screen runs in the same tab now (no longer its own window), so leaving
  // means navigating back to the control center rather than closing the tab.
  const handleClose = useMemo(
    () => () => {
      if (runId) clearLotterySession(runId)
      if (id) navigate(`/events/${id}/control`)
      else navigate('/events')
    },
    [runId, id, navigate],
  )

  function handleLaunch(payload: Omit<LotterySessionPayload, 'createdAt'>) {
    if (!id) return
    const nextRunId = saveLotterySession(payload)
    setSession({ ...payload, createdAt: Date.now() })
    setSearchParams({ run: nextRunId }, { replace: true })
  }

  if (locked) {
    return (
      <>
        <ScreenControls onBack={handleClose} soundScope="lottery" />
        <LotteryBroadcastLayout
          stage={
            <div className="max-w-md text-center">
              <p className="text-2xl font-black text-foreground">ההגרלה זמינה במשחק המלא</p>
              <p className="mt-3 text-base font-semibold text-muted">
                ההגרלה כלולה במשחק המלא ובמשחק ללא אינטרנט. אפשר לשדרג מתוך המסלולים.
              </p>
            </div>
          }
          dock={
            <p className="w-full text-center text-sm font-medium text-muted">
              חזרו למסך המשחק כדי לראות את המסלולים
            </p>
          }
        />
      </>
    )
  }

  if (!id) {
    return (
      <>
        <ScreenControls to="/events" soundScope="lottery" />
        <LotteryBroadcastLayout
          stage={
            <div className="max-w-md text-center">
              <p className="text-2xl font-black text-foreground">ההגרלה אינה זמינה</p>
              <p className="mt-3 text-base font-semibold text-muted">
                הפעילו מחדש מתוך הפעלות בזמן אמת.
              </p>
            </div>
          }
          dock={<p className="w-full text-center text-sm font-medium text-muted">אין פעולות זמינות</p>}
        />
      </>
    )
  }

  // Preparing / setup - same layout, stage placeholder + organizer dock.
  if (!runId) {
    // Wait for the flag before drawing the dock. The dock itself is the same
    // either way - it opens on the points lottery regardless - but a choice
    // appearing a moment after the organizer has looked at it is worse than a
    // beat of loading. A game whose plan never resolved is not kept waiting:
    // its flags cannot resolve either, and the answer there is the lottery as
    // it always was.
    if (flagLoading && plan != null) return <FullPageLoader />
    return (
      <>
        <ScreenControls onBack={handleClose} soundScope="lottery" />
        <LotteryConfigurationCard
          eventId={id}
          scanLotteryAvailable={scanLotteryAvailable}
          scanningAllowed={scanningAllowed}
          scanningBlockedReason={scanningBlockedReason}
          onLaunch={handleLaunch}
        />
      </>
    )
  }

  if (session === undefined) return <FullPageLoader />

  if (!session) {
    return (
      <>
        <ScreenControls onBack={handleClose} soundScope="lottery" />
        <LotteryBroadcastLayout
          stage={<LotteryPreparingStage />}
          dock={
            <p className="w-full text-center text-sm font-medium text-muted">
              ההגרלה אינה זמינה - הפעילו מחדש מתוך הפעלות בזמן אמת.
            </p>
          }
        />
      </>
    )
  }

  return (
    <>
      <ScreenControls onBack={handleClose} soundScope="lottery" />
      <LotteryPresentation
        config={session.config}
        participants={session.participants}
        isTrial={isTrial}
        onClose={handleClose}
      />
    </>
  )
}
