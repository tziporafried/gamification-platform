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

const CONFETTI_COLORS = ['#7c3aed', '#a855f7', '#ec4899', '#f97316', '#fbbf24', '#22c55e', '#06b6d4', '#8b5cf6']

interface ConfettiPiece {
  left: string
  delay: string
  color: string
  size: number
  rotation: number
  isCircle: boolean
}

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, () => ({
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2.5}s`,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 5 + Math.random() * 8,
    rotation: Math.random() * 360,
    isCircle: Math.random() > 0.5,
  }))
}

function getTierConfig(points: number) {
  if (points >= 2000) return {
    Icon: Gem,
    gradient: 'gradient-diamond',
    border: 'border-purple-500/40',
    glow: '0 0 40px rgba(139, 92, 246, 0.4), 0 0 80px rgba(6, 182, 212, 0.2)',
    title: '!פתיחה אגדית',
    label: 'אגדי',
    confettiCount: 80,
  }
  if (points >= 1000) return {
    Icon: Trophy,
    gradient: 'gradient-gold',
    border: 'border-amber-500/40',
    glow: '0 0 40px rgba(251, 191, 36, 0.4)',
    title: '!הישג נפתח',
    label: 'זהב',
    confettiCount: 60,
  }
  if (points >= 500) return {
    Icon: Award,
    gradient: 'gradient-silver',
    border: 'border-gray-400/40',
    glow: '0 0 24px rgba(156, 163, 175, 0.3)',
    title: '!הישג חדש',
    label: 'כסף',
    confettiCount: 45,
  }
  return {
    Icon: Star,
    gradient: 'gradient-bronze',
    border: 'border-orange-500/40',
    glow: '0 0 24px rgba(217, 119, 6, 0.3)',
    title: '!פרס חדש',
    label: 'ארד',
    confettiCount: 40,
  }
}

export function CelebrationModal({ rewards, participantName, onComplete }: CelebrationModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showFlash, setShowFlash] = useState(true)
  const [showContent, setShowContent] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { play } = useCelebrationSound()

  const reward = rewards[currentIndex]
  const isLast = currentIndex === rewards.length - 1
  const tier = getTierConfig(reward.out_required_points)
  const confetti = useMemo(() => generateConfetti(tier.confettiCount), [tier.confettiCount])

  useEffect(() => {
    play()
    setShowFlash(true)
    setShowContent(false)
    const flashTimer = setTimeout(() => setShowFlash(false), 300)
    const contentTimer = setTimeout(() => setShowContent(true), 200)
    return () => { clearTimeout(flashTimer); clearTimeout(contentTimer) }
  }, [currentIndex, play])

  useEffect(() => {
    buttonRef.current?.focus()
  }, [showContent])

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
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" />

      {showFlash && (
        <div className="fixed inset-0 bg-white animate-screen-flash pointer-events-none z-20" />
      )}

      {confetti.map((piece, i) => (
        <div
          key={i}
          className="pointer-events-none fixed opacity-0 animate-confetti-fall"
          style={{
            left: piece.left,
            top: 0,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            transform: `rotate(${piece.rotation}deg)`,
            borderRadius: piece.isCircle ? '50%' : '2px',
          }}
        />
      ))}

      {showContent && (
        <div
          className="relative z-10 w-full max-w-sm mx-4 overflow-hidden rounded-3xl border bg-game-dark animate-scale-in"
          style={{
            borderColor: 'rgba(139, 92, 246, 0.3)',
            boxShadow: tier.glow,
          }}
        >
          <div className="relative">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `radial-gradient(circle at 50% 0%, ${CONFETTI_COLORS[0]}40 0%, transparent 70%)`,
              }}
            />

            <div className="relative p-8 text-center">
              <div
                className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-white animate-celebration-bounce ${tier.gradient}`}
                style={{ boxShadow: tier.glow }}
              >
                <tier.Icon size={40} />
              </div>

              <div className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">
                {tier.label}
              </div>

              <h2 className="mb-3 text-2xl font-black text-white">
                {tier.title}
              </h2>

              <p className="mb-1 text-sm text-gray-400">
                {participantName} הגיע ל-<span className="font-bold text-white">{reward.out_total_points.toLocaleString()}</span> נקודות
              </p>

              <div className="my-5 rounded-2xl border border-game-border bg-game-card p-4">
                <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                  פרס
                </div>
                <p className="text-xl font-black text-white">
                  {reward.out_reward_name}
                </p>
                {reward.out_reward_description && (
                  <p className="mt-1 text-sm text-gray-500">{reward.out_reward_description}</p>
                )}
              </div>

              <XPBar
                current={reward.out_total_points}
                target={reward.out_required_points}
                label={`${reward.out_required_points.toLocaleString()} נק׳ נדרשות`}
                className="mb-5"
              />

              <Button
                ref={buttonRef}
                variant="gradient"
                size="lg"
                className="w-full font-bold tracking-wide animate-glow-pulse"
                onClick={handleContinue}
              >
                {isLast ? 'המשך' : `הבא (${currentIndex + 1}/${rewards.length})`}
              </Button>

              {rewards.length > 1 && (
                <div className="mt-4 flex justify-center gap-2">
                  {rewards.map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        i === currentIndex ? 'bg-brand-400' : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
