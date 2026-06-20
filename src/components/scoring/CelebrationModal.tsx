import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { useCelebrationSound } from '@/hooks/useCelebrationSound'
import type { NewlyAwardedReward } from '@/types'

interface CelebrationModalProps {
  rewards: NewlyAwardedReward[]
  participantName: string
  onComplete: () => void
}

const CONFETTI_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4']

interface ConfettiPiece {
  left: string
  delay: string
  color: string
}

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, () => ({
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  }))
}

export function CelebrationModal({ rewards, participantName, onComplete }: CelebrationModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { play } = useCelebrationSound()
  const confetti = useMemo(() => generateConfetti(40), [])

  const reward = rewards[currentIndex]
  const isLast = currentIndex === rewards.length - 1

  console.log('[CelebrationModal Debug] Rendering modal:', {
    rewardCount: rewards.length,
    currentIndex,
    currentReward: reward,
    participantName,
  })

  useEffect(() => {
    play()
  }, [currentIndex, play])

  useEffect(() => {
    buttonRef.current?.focus()
  }, [currentIndex])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  function handleContinue() {
    if (isLast) {
      onComplete()
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault()
      buttonRef.current?.focus()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      <div className="fixed inset-0 bg-black/60" />

      {confetti.map((piece, i) => (
        <div
          key={i}
          className="pointer-events-none fixed h-2 w-2 rounded-sm opacity-0 animate-confetti-fall"
          style={{
            left: piece.left,
            top: 0,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
          }}
        />
      ))}

      <div
        className="relative z-10 w-full max-w-sm mx-4 rounded-2xl bg-white p-8 text-center shadow-2xl"
        style={{ animation: 'scale-in 0.4s ease-out both, glow-pulse 2s ease-in-out 0.4s infinite' }}
      >
        <div className="mb-4 text-5xl animate-celebration-bounce">🏆</div>

        <h2 className="mb-2 text-2xl font-bold text-gray-900">
          Congratulations!
        </h2>

        <p className="mb-1 text-sm text-gray-600">
          Dear {participantName},
        </p>
        <p className="mb-4 text-sm text-gray-600">
          You have reached <span className="font-semibold text-gray-900">{reward.out_total_points}</span> points.
        </p>

        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
          You earned
        </div>
        <p className="mb-1 text-xl font-bold text-brand-600">
          {reward.out_reward_name}
        </p>
        {reward.out_reward_description && (
          <p className="mb-4 text-sm text-gray-500">{reward.out_reward_description}</p>
        )}
        {!reward.out_reward_description && <div className="mb-4" />}

        <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
          {reward.out_required_points} points required
        </span>

        <div className="mt-6">
          <Button
            ref={buttonRef}
            className="w-full"
            onClick={handleContinue}
          >
            {isLast ? 'Close' : 'Continue'}
          </Button>
        </div>

        {rewards.length > 1 && (
          <p className="mt-3 text-xs text-gray-400">
            Reward {currentIndex + 1} of {rewards.length}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
