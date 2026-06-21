import { useState, useEffect, useMemo } from 'react'
import { Crown, Medal, User } from 'lucide-react'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { cn } from '@/lib/utils'
import type { WinnerPhase } from '@/hooks/useRevealSequence'

const MEDAL_COLORS: Record<number, string> = {
  1: '#fbbf24',
  2: '#9ca3af',
  3: '#d97706',
}

const COUNT_DURATIONS: Record<number, number> = { 3: 1200, 2: 1500, 1: 1800 }

const CONFETTI_PALETTES: Record<number, string[]> = {
  1: ['#fbbf24', '#f59e0b', '#d97706', '#7c3aed', '#a855f7', '#ec4899', '#22c55e', '#06b6d4'],
  2: ['#9ca3af', '#d1d5db', '#e5e7eb', '#6b7280', '#a78bfa', '#c4b5fd'],
  3: ['#d97706', '#f59e0b', '#92400e', '#fbbf24', '#ea580c', '#c2410c'],
}

interface ConfettiPiece {
  left: string
  delay: string
  color: string
  size: number
  rotation: number
  isCircle: boolean
}

function generateConfetti(rank: number): ConfettiPiece[] {
  const count = rank === 1 ? 60 : rank === 2 ? 40 : 30
  const palette = CONFETTI_PALETTES[rank]
  return Array.from({ length: count }, () => ({
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.5}s`,
    color: palette[Math.floor(Math.random() * palette.length)],
    size: 4 + Math.random() * 7,
    rotation: Math.random() * 360,
    isCircle: Math.random() > 0.5,
  }))
}

function useRevealCountUp(target: number, active: boolean, duration: number): { value: number; done: boolean } {
  const [value, setValue] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!active) {
      setValue(0)
      setDone(false)
      return
    }

    let startTime: number | null = null
    let raf = 0

    function step(timestamp: number) {
      if (startTime === null) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))

      if (progress < 1) {
        raf = requestAnimationFrame(step)
      } else {
        setDone(true)
      }
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])

  return { value, done }
}

interface RevealPodiumProps {
  rank: 1 | 2 | 3
  name: string
  detail?: string
  color?: string
  totalPoints: number
  phase: WinnerPhase
}

export function RevealPodium({
  rank,
  name,
  detail,
  color,
  totalPoints,
  phase,
}: RevealPodiumProps) {
  const medalColor = MEDAL_COLORS[rank]
  const isFirst = rank === 1
  const isCounting = phase === 'counting' || phase === 'named'
  const isNamed = phase === 'named'
  const countDuration = COUNT_DURATIONS[rank] ?? 1500

  const { value: countValue } = useRevealCountUp(totalPoints, isCounting, isNamed ? 1 : countDuration)
  const displayPoints = isNamed ? totalPoints : countValue

  const confetti = useMemo(() => generateConfetti(rank), [rank])
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (phase === 'named') {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(t)
    } else {
      setShowConfetti(false)
    }
  }, [phase])

  if (phase === 'hidden') return null

  const glowStyle = isCounting ? {
    boxShadow: rank === 1
      ? '0 0 40px rgba(251, 191, 36, 0.4), 0 0 80px rgba(251, 191, 36, 0.2)'
      : rank === 2
        ? '0 0 30px rgba(156, 163, 175, 0.3), 0 0 60px rgba(156, 163, 175, 0.15)'
        : '0 0 30px rgba(217, 119, 6, 0.3), 0 0 60px rgba(217, 119, 6, 0.15)',
  } : {}

  return (
    <div className="relative">
      {showConfetti && (
        <div className="pointer-events-none absolute -inset-x-4 -top-8 bottom-0 overflow-visible z-10">
          {confetti.map((piece, i) => (
            <div
              key={i}
              className="absolute opacity-0 animate-confetti-fall"
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
        </div>
      )}

      <div
        className={cn(
          'flex flex-col items-center rounded-2xl border bg-game-card overflow-hidden transition-all duration-500',
          phase === 'entrance' && 'opacity-0 animate-scale-in border-game-border',
          isCounting && 'border-opacity-60',
          isNamed && isFirst && 'animate-celebration-bounce',
        )}
        style={{
          borderColor: isCounting ? medalColor + '60' : undefined,
          ...glowStyle,
          animationDelay: phase === 'entrance' ? `${(3 - rank) * 0.15}s` : undefined,
        }}
      >
        <div
          className={cn(
            'flex w-full flex-col items-center px-4 bg-gradient-to-b transition-all duration-500',
            isFirst ? 'pt-6 pb-6' : 'pt-5 pb-5',
            rank === 1 && 'from-amber-500/20 via-yellow-500/10 to-transparent',
            rank === 2 && 'from-gray-400/10 via-gray-300/5 to-transparent',
            rank === 3 && 'from-orange-500/10 via-amber-500/5 to-transparent',
          )}
        >
          {isFirst && isNamed && (
            <Crown
              size={28}
              className="mb-2 animate-crown-glow"
              style={{ color: '#fbbf24' }}
              fill="#fbbf24"
            />
          )}

          <div className="relative mb-3">
            {isNamed ? (
              <div className="animate-scale-in">
                <AvatarCircle
                  name={name}
                  size={isFirst ? 'lg' : 'md'}
                  ringColor={color || medalColor}
                />
              </div>
            ) : (
              <div
                className={cn(
                  'inline-flex shrink-0 items-center justify-center rounded-full border-2 border-dashed',
                  isFirst ? 'h-12 w-12' : 'h-10 w-10',
                  isCounting ? 'animate-glow-pulse' : '',
                )}
                style={{ borderColor: medalColor + '40' }}
              >
                <User
                  size={isFirst ? 22 : 18}
                  className="text-gray-600"
                />
              </div>
            )}
            <div
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-lg"
              style={{ backgroundColor: medalColor }}
            >
              {rank}
            </div>
          </div>

          {isNamed ? (
            <div className="animate-fade-in-up">
              <p className={cn(
                'w-full truncate text-center font-bold',
                isFirst ? 'text-base text-white' : 'text-sm text-gray-200',
              )}>
                {name}
              </p>
              {detail && (
                <p className="w-full truncate text-center text-xs text-gray-500">
                  {detail}
                </p>
              )}
            </div>
          ) : (
            <div className="h-5" />
          )}

          <div className="mt-3 flex items-baseline gap-1">
            {isCounting ? (
              <>
                <span className={cn(
                  'tabular-nums font-bold transition-all',
                  isFirst ? 'text-3xl text-amber-400' : 'text-2xl text-gray-200',
                )}>
                  {displayPoints.toLocaleString()}
                </span>
                <span className={cn(
                  'text-sm font-medium',
                  isFirst ? 'text-amber-500/60' : 'text-gray-500',
                )}>
                  נק׳
                </span>
              </>
            ) : (
              <span className="text-2xl font-bold text-gray-600">?</span>
            )}
          </div>

          <span
            className="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold"
            style={{
              backgroundColor: medalColor + '20',
              color: medalColor,
            }}
          >
            {rank <= 2 && <Medal size={11} />}
            {rank === 1 ? 'אלוף' : rank === 2 ? 'סגן אלוף' : 'מקום שלישי'}
          </span>
        </div>
      </div>
    </div>
  )
}
