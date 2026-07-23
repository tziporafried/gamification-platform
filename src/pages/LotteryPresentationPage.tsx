import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { ScreenControls } from '@/components/ui/ScreenControls'
import { supabase } from '@/lib/supabase'
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
 * Open to any event owner; trial-plan events run the full ceremony but mask
 * the winner's identity (see LotteryPresentation) instead of blocking access.
 */
export function LotteryPresentationPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const runId = searchParams.get('run') ?? ''
  const [session, setSession] = useState<LotterySessionPayload | null | undefined>(
    runId ? undefined : null,
  )
  const [isTrial, setIsTrial] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!id) {
      setIsTrial(false)
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
        setIsTrial(data?.plan === 'free')
      })
    return () => {
      cancelled = true
    }
  }, [id])

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

  if (isTrial === undefined) {
    return <FullPageLoader />
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
