import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FullPageLoader } from '@/components/ui/FullPageLoader'
import { LotteryPresentation } from '@/components/live-events/lottery/LotteryPresentation'
import {
  clearLotterySession,
  loadLotterySession,
  type LotterySessionPayload,
} from '@/components/live-events/lottery/lotterySession'

export function LotteryPresentationPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const runId = searchParams.get('run') ?? ''
  const [session, setSession] = useState<LotterySessionPayload | null | undefined>(undefined)

  useEffect(() => {
    if (!id || !runId) {
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
      // Opened via window.open — close the presentation tab.
      window.close()
      // Fallback if the browser blocks window.close().
      if (id) navigate(`/events/${id}/live-events`, { replace: true })
    },
    [runId, id, navigate],
  )

  if (session === undefined) return <FullPageLoader />

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-radial px-4" dir="rtl">
        <div className="max-w-md rounded-2xl border border-border bg-white/80 p-8 text-center shadow-card">
          <p className="text-lg font-bold text-foreground">ההגרלה אינה זמינה</p>
          <p className="mt-2 text-sm text-muted">הפעילו מחדש מתוך הפעלות בזמן אמת.</p>
        </div>
      </div>
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
