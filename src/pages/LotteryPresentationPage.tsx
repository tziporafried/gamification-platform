import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { useAuth } from '@/contexts/AuthContext'
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
 * Public launch stays "coming soon"; super admins can open for QA.
 */
export function LotteryPresentationPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isSuperAdmin, loading: authLoading } = useAuth()
  const runId = searchParams.get('run') ?? ''
  const [session, setSession] = useState<LotterySessionPayload | null | undefined>(
    runId ? undefined : null,
  )

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

  const handleClose = useMemo(
    () => () => {
      if (runId) clearLotterySession(runId)
      window.close()
      if (id) navigate(`/events/${id}/control`, { replace: true })
    },
    [runId, id, navigate],
  )

  function handleLaunch(payload: Omit<LotterySessionPayload, 'createdAt'>) {
    if (!id) return
    const nextRunId = saveLotterySession(payload)
    setSession({ ...payload, createdAt: Date.now() })
    setSearchParams({ run: nextRunId }, { replace: true })
  }

  if (authLoading) {
    return <FullPageLoader />
  }

  if (!isSuperAdmin) {
    return (
      <LotteryBroadcastLayout
        stage={
          <div className="max-w-md text-center">
            <p className="text-2xl font-black text-foreground">ההגרלה בקרוב</p>
            <p className="mt-3 text-base font-semibold text-muted">
              ההפעלה עדיין לא זמינה לכולם.
            </p>
          </div>
        }
        dock={<p className="w-full text-center text-sm font-medium text-muted">אין פעולות זמינות</p>}
      />
    )
  }

  if (!id) {
    return (
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
    )
  }

  // Preparing / setup - same layout, stage placeholder + organizer dock.
  if (!runId) {
    return <LotteryConfigurationCard eventId={id} onLaunch={handleLaunch} />
  }

  if (session === undefined) return <FullPageLoader />

  if (!session) {
    return (
      <LotteryBroadcastLayout
        stage={<LotteryPreparingStage />}
        dock={
          <p className="w-full text-center text-sm font-medium text-muted">
            ההגרלה אינה זמינה - הפעילו מחדש מתוך הפעלות בזמן אמת.
          </p>
        }
      />
    )
  }

  return (
    <LotteryPresentation
      config={session.config}
      participants={session.participants}
      onClose={handleClose}
    />
  )
}
