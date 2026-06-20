import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Trophy, Star, Award, Gem } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { XPBar } from '@/components/ui/XPBar'
import { useCelebrationSound } from '@/hooks/useCelebrationSound'
import type { NewlyAwardedReward } from '@/types'

interface CelebrationModalProps {
  rewards: NewlyAwardedReward[]
  participantName: string
  onComplete: () => void
}

const CONFETTI_COLORS = ['#7c3aed', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4']

interface ConfettiPiece {
  left: string
  delay: string
  color: string
  size: number
  rotation: number
}

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, () => ({
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2.5}s`,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 6 + Math.random() * 6,
    rotation: Math.random() * 360,
  }))
}

function getTierIcon(points: number) {
  if (points >= 2000) return { Icon: Gem, gradient: 'from-violet-500 to-purple-600', label: 'Diamond Tier' }
  if (points >= 1000) return { Icon: Trophy, gradient: 'from-amber-500 to-yellow-500', label: 'Gold Tier' }
  if (points >= 500) return { Icon: Award, gradient: 'from-gray-400 to-gray-500', label: 'Silver Tier' }
  return { Icon: Star, gradient: 'from-orange-500 to-amber-600', label: 'Bronze Tier' }
}

export function CelebrationModal({ rewards, participantName, onComplete }: CelebrationModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { play } = useCelebrationSound()

  const reward = rewards[currentIndex]
  const isLast = currentIndex === rewards.length - 1
  const isPremium = reward.out_required_points >= 2000
  const confetti = useMemo(() => generateConfetti(isPremium ? 60 : 40), [isPremium])
  const tier = getTierIcon(reward.out_required_points)

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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {confetti.map((piece, i) => (
        <div
          key={i}
          className="pointer-events-none fixed rounded-sm opacity-0 animate-confetti-fall"
          style={{
            left: piece.left,
            top: 0,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}

      <div
        className="relative z-10 w-full max-w-sm mx-4 overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: 'scale-in 0.4s ease-out both, glow-pulse 2s ease-in-out 0.4s infinite' }}
      >
        <div className={`h-2 w-full bg-gradient-to-r ${tier.gradient}`} />

        <div className="p-8 text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${tier.gradient} text-white animate-celebration-bounce`}
          >
            <tier.Icon size={32} />
          </div>

          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {tier.label}
          </div>

          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            Congratulations!
          </h2>

          <p className="mb-1 text-sm text-gray-600">
            {participantName} has reached <span className="font-bold text-gray-900">{reward.out_total_points.toLocaleString()}</span> points
          </p>

          <div className="my-5 rounded-xl bg-brand-50/60 p-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-brand-400">
              Reward Unlocked
            </div>
            <p className="text-lg font-bold text-brand-700">
              {reward.out_reward_name}
            </p>
            {reward.out_reward_description && (
              <p className="mt-1 text-sm text-gray-500">{reward.out_reward_description}</p>
            )}
          </div>

          <XPBar
            current={reward.out_total_points}
            target={reward.out_required_points}
            label={`${reward.out_required_points.toLocaleString()} pts required`}
            className="mb-5"
          />

          <Button
            ref={buttonRef}
            variant="gradient"
            className="w-full"
            onClick={handleContinue}
          >
            {isLast ? 'Continue' : `Next Reward (${currentIndex + 1}/${rewards.length})`}
          </Button>

          {rewards.length > 1 && (
            <div className="mt-3 flex justify-center gap-1.5">
              {rewards.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i === currentIndex ? 'bg-brand-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
