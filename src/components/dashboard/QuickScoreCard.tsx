import { useState, useEffect, useRef, FormEvent } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
      <div className="rounded-xl border border-gray-200 bg-white shadow-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
            <Zap size={18} className="text-emerald-500" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Quick Score</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex gap-3">
            <Input
              ref={participantInputRef}
              id="quick-participant-code"
              placeholder="P-1001"
              value={participantCode}
              onChange={(e) => setParticipantCode(e.target.value)}
              className="text-center"
            />
            <Input
              id="quick-action-code"
              placeholder="A-1001"
              value={actionCode}
              onChange={(e) => setActionCode(e.target.value)}
              className="text-center"
            />
            <div className="relative shrink-0">
              <Button type="submit" loading={submitting} className="h-full">
                Submit
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
