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

const CONFETTI_COLORS = [
  'var(--color-primary)',
  'var(--color-primary-hover)',
  'var(--color-accent)',
  'var(--color-warning)',
  'var(--color-success)',
  'var(--color-secondary)',
  'var(--color-danger)',
  'var(--color-muted)',
]

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
    border: 'border-accent/40',
    glow: '0 0 40px color-mix(in srgb, var(--color-primary) 40%, transparent), 0 0 80px color-mix(in srgb, var(--color-secondary) 20%, transparent)',
    title: '!פתיחה אגדית',
    confettiCount: 80,
  }
  if (points >= 1000) return {
    Icon: Trophy,
    gradient: 'gradient-gold',
    border: 'border-warning/40',
    glow: '0 0 40px color-mix(in srgb, var(--color-warning) 40%, transparent)',
    title: '!הישג נפתח',
    confettiCount: 60,
  }
  if (points >= 500) return {
    Icon: Award,
    gradient: 'gradient-silver',
    border: 'border-border',
    glow: '0 0 24px color-mix(in srgb, var(--color-muted) 30%, transparent)',
    title: '!הישג חדש',
    confettiCount: 45,
  }
  return {
    Icon: Star,
    gradient: 'gradient-bronze',
    border: 'border-accent/40',
    glow: '0 0 24px color-mix(in srgb, var(--color-accent) 30%, transparent)',
    title: '!פרס חדש',
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
      <div className="fixed inset-0 bg-foreground/40 backdrop-blur-md" />

      {showFlash && (
        <div className="fixed inset-0 bg-background animate-screen-flash pointer-events-none z-20" />
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
          className="relative z-10 w-full max-w-sm mx-4 overflow-hidden rounded-3xl border border-accent/30 bg-surface animate-scale-in"
          style={{
            boxShadow: tier.glow,
          }}
        >
          <div className="relative">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: 'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--color-primary) 25%, transparent) 0%, transparent 70%)',
              }}
            />

            <div className="relative p-8 text-center">
              <div
                className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-foreground animate-celebration-bounce ${tier.gradient}`}
                style={{ boxShadow: tier.glow }}
              >
                <tier.Icon size={40} />
              </div>

              <h2 className="mb-3 text-2xl font-black text-foreground">
                {tier.title}
              </h2>

              <p className="mb-1 text-sm text-muted">
                {participantName} הגיע ל-<span className="font-bold text-foreground">{reward.out_total_points.toLocaleString()}</span> נקודות
              </p>

              <div className="my-5 rounded-2xl border border-border bg-surface-elevated p-4">
                <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted">
                  פרס
                </div>
                <p className="text-xl font-black text-foreground">
                  {reward.out_reward_name}
                </p>
                {reward.out_reward_description && (
                  <p className="mt-1 text-sm text-muted">{reward.out_reward_description}</p>
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
                        i === currentIndex ? 'bg-accent' : 'bg-border'
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
