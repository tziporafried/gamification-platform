import { useState, useEffect, useRef, FormEvent } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PointsFlyUp } from '@/components/ui/PointsFlyUp'
import { Toast } from '@/components/ui/Toast'
import { CelebrationModal } from '@/components/scoring/CelebrationModal'
import { useScoreSubmit } from '@/hooks/useScoreSubmit'
import type { NewlyAwardedReward } from '@/types'

interface QuickScoreCardProps {
  eventId: string
  onScoreSubmitted?: () => void
}

export function QuickScoreCard({ eventId, onScoreSubmitted }: QuickScoreCardProps) {
  const [participantCode, setParticipantCode] = useState('')
  const [actionCode, setActionCode] = useState('')
  const [flyUpPoints, setFlyUpPoints] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const [celebrationRewards, setCelebrationRewards] = useState<NewlyAwardedReward[]>([])
  const [celebratingParticipantName, setCelebratingParticipantName] = useState('')
  const participantInputRef = useRef<HTMLInputElement>(null)

  const { submit, submitting, lastError } = useScoreSubmit(eventId)

  useEffect(() => {
    if (lastError) {
      setToast({ message: lastError, variant: 'error' })
    }
  }, [lastError])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setToast(null)

    const result = await submit(participantCode, actionCode)
    if (!result) return

    if (result.celebrationRewards.length > 0) {
      setCelebratingParticipantName(result.participantName)
      setCelebrationRewards(result.celebrationRewards)
    }

    setFlyUpPoints(result.points)

    const sign = result.points >= 0 ? '+' : ''
    setToast({
      message: `${sign}${result.points} pts to ${result.participantName} for ${result.actionName}`,
      variant: 'success',
    })

    setParticipantCode('')
    setActionCode('')
    onScoreSubmitted?.()
    participantInputRef.current?.focus()
  }

  return (
    <>
      <div className="rounded-2xl border border-game-border bg-game-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-game-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
            <Zap size={18} className="text-emerald-400" />
          </div>
          <h3 className="text-base font-bold text-white">Award Points</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="flex gap-3">
            <input
              ref={participantInputRef}
              placeholder="Player code"
              value={participantCode}
              onChange={(e) => setParticipantCode(e.target.value)}
              className="w-full rounded-xl border border-game-border bg-game-dark px-3 py-2.5 text-center text-sm font-medium text-white placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input
              placeholder="Action code"
              value={actionCode}
              onChange={(e) => setActionCode(e.target.value)}
              className="w-full rounded-xl border border-game-border bg-game-dark px-3 py-2.5 text-center text-sm font-medium text-white placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="relative shrink-0">
              <Button type="submit" variant="gradient" loading={submitting} className="h-full rounded-xl px-5">
                <Zap size={16} />
              </Button>
              <PointsFlyUp points={flyUpPoints} onDone={() => setFlyUpPoints(null)} />
            </div>
          </div>
        </form>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          autoDismissMs={toast.variant === 'success' ? 3000 : undefined}
          onDismiss={() => setToast(null)}
        />
      )}

      {celebrationRewards.length > 0 && (
        <CelebrationModal
          rewards={celebrationRewards}
          participantName={celebratingParticipantName}
          onComplete={() => setCelebrationRewards([])}
        />
      )}
    </>
  )
}
