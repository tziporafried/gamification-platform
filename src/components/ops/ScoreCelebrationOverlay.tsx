import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'

export interface CelebrationOverlayData {
  name: string
  points: number
}

interface Props extends CelebrationOverlayData {
  accent: AccentRgb
  onDismiss: () => void
}

const CONFETTI_COLORS = [
  'var(--color-warning)',
  'var(--color-accent)',
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-secondary)',
  'var(--color-primary-hover)',
  'var(--color-danger)',
]

export function ScoreCelebrationOverlay({ name, points, accent, onDismiss }: Props) {
  useEffect(() => {
    function handler() { onDismiss() }
    window.addEventListener('keydown', handler)
    window.addEventListener('pointerdown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('pointerdown', handler)
    }
  }, [onDismiss])

  const confettiParticles = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 500,
      y: -200 - Math.random() * 300,
      rotation: Math.random() * 1080 - 540,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 4 + Math.random() * 7,
      isCircle: Math.random() > 0.5,
    }))
  , [])

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}>

      {/* Confetti particles */}
      {confettiParticles.map(p => (
        <motion.div key={p.id}
          className="pointer-events-none fixed z-[201]"
          style={{
            left: '50%', top: '50%',
            width: p.size, height: p.size,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
          }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0 }}
          animate={{ x: p.x, y: p.y, rotate: p.rotation, opacity: 0, scale: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }} />
      ))}

      <motion.div
        className="relative z-[202] flex flex-col items-center gap-5 rounded-3xl border border-secondary bg-surface-elevated p-8 text-center mx-4 shadow-podium"
        style={{
          minWidth: 280,
          maxWidth: 380,
          boxShadow: `0 0 40px ${rgba(accent, 0.2)}`,
        }}
        initial={{ scale: 0.85, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 1.05, opacity: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 300 }}>

        <span className="text-5xl leading-none">🎉</span>

        <div>
          <p className="text-xl font-black text-foreground leading-snug">{name}</p>
          <p className="text-sm text-muted mt-1">צבר נקודות</p>
        </div>

        <div className="flex items-baseline gap-1.5 text-secondary" style={{ color: rgba(accent, 1) }}>
          <span className="text-3xl font-black">+</span>
          <AnimatedCounter
            value={points}
            duration={600}
            className="text-8xl font-black leading-none"
          />
        </div>
        <span className="text-xl font-bold text-muted -mt-3">נקודות</span>
      </motion.div>
    </motion.div>
  )
}
