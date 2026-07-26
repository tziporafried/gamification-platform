import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { ScreenControls } from '@/components/ui/ScreenControls'
import { supabase } from '@/lib/supabase'
import { canRunLottery } from '@/hooks/usePlanPermissions'
import type { UserPlan } from '@/types'
import { LotteryBroadcastLayout } from '@/components/live-events/lottery/LotteryBroadcastLayout'
import { LotteryConfigurationCard } from '@/components/live-events/lottery/LotteryConfigurationCard'
import { LotteryPreparingStage } from '@/components/live-events/lottery/LotteryPreparingStage'
import { LotteryPresentation } from '@/components/live-events/lottery/LotteryPresentation'
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
 */
export function LotteryPresentationPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const runId = searchParams.get('run') ?? ''
  const [session, setSession] = useState<LotterySessionPayload | null | undefined>(
    runId ? undefined : null,
  )
  const [plan, setPlan] = useState<UserPlan | null | undefined>(undefined)

  useEffect(() => {
    if (!id) {
      setPlan(null)
      return
    }
    let cancelled = false
    supabase
      .from('events')
      .select('plan')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setPlan((data?.plan as UserPlan | undefined) ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const isTrial = plan === 'free'
  const locked = plan != null && !canRunLottery(plan)

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

  if (plan === undefined) {
    return <FullPageLoader />
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
    return (
      <>
        <ScreenControls onBack={handleClose} soundScope="lottery" />
        <LotteryConfigurationCard eventId={id} onLaunch={handleLaunch} />
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
