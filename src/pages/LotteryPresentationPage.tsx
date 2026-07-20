import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { LotteryConfigurationCard } from '@/components/live-events/lottery/LotteryConfigurationCard'
import { LotteryPresentation } from '@/components/live-events/lottery/LotteryPresentation'
import {
  clearLotterySession,
  loadLotterySession,
  saveLotterySession,
  type LotterySessionPayload,
} from '@/components/live-events/lottery/lotterySession'

/**
 * Broadcast-ready lottery tab - same rules as kiosk/scan:
 * no AppShell, no GlobalHeader; opened in a dedicated window for the projector.
 */
export function LotteryPresentationPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
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
      // Fallback if the browser blocks window.close() (e.g. tab not script-opened).
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

  if (!id) {
    return (
      <BroadcastShell>
        <UnavailableMessage />
      </BroadcastShell>
    )
  }

  // Setup mode - still broadcast chrome (no platform header).
  if (!runId) {
    return (
      <BroadcastShell>
        <div className="flex min-h-screen flex-col justify-center px-4 py-8">
          <LotteryConfigurationCard eventId={id} onLaunch={handleLaunch} />
        </div>
      </BroadcastShell>
    )
  }

  if (session === undefined) return <FullPageLoader />

  if (!session) {
    return (
      <BroadcastShell>
        <div className="flex min-h-screen items-center justify-center px-4">
          <UnavailableMessage />
        </div>
      </BroadcastShell>
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

function BroadcastShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-app-radial font-sans text-foreground" dir="rtl">
      {children}
    </div>
  )
}

function UnavailableMessage() {
  return (
    <div className="max-w-md rounded-2xl border border-border bg-white/80 p-8 text-center shadow-card">
      <p className="text-lg font-bold text-foreground">ההגרלה אינה זמינה</p>
      <p className="mt-2 text-sm text-muted">הפעילו מחדש מתוך הפעלות בזמן אמת.</p>
    </div>
  )
}
