import { useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'

export interface CelebrationOverlayData {
  name: string
  points: number
  bonus: boolean
  mult: string
}

interface Props extends CelebrationOverlayData {
  accent: AccentRgb
  onDismiss: () => void
}

const CONFETTI_COLORS = ['#fbbf24', '#f97316', '#a855f7', '#22c55e', '#06b6d4', '#ec4899', '#8b5cf6']

export function ScoreCelebrationOverlay({ name, points, bonus, mult, accent, onDismiss }: Props) {
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
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(0,0,0,0.8)' }}
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
        className="relative z-[202] flex flex-col items-center gap-5 rounded-3xl p-8 text-center mx-4"
        style={{
          background: bonus
            ? 'linear-gradient(135deg, rgba(17,10,5,0.98) 0%, rgba(30,12,0,0.98) 100%)'
            : 'linear-gradient(135deg, rgba(13,8,28,0.98) 0%, rgba(18,10,38,0.98) 100%)',
          border: bonus
            ? '1px solid rgba(249,115,22,0.55)'
            : `1px solid ${rgba(accent, 0.55)}`,
          boxShadow: bonus
            ? '0 0 60px rgba(249,115,22,0.3), 0 0 120px rgba(249,115,22,0.12)'
            : `0 0 60px ${rgba(accent, 0.3)}, 0 0 120px ${rgba(accent, 0.12)}`,
          minWidth: 280,
          maxWidth: 380,
        }}
        initial={{ scale: 0.85, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 1.05, opacity: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 300 }}>

        <span className="text-5xl leading-none">🎉</span>

        <div>
          <p className="text-xl font-black text-white leading-snug">{name}</p>
          <p className="text-sm text-gray-400 mt-1">צבר נקודות</p>
        </div>

        <div className="flex items-baseline gap-1.5" style={{ color: bonus ? '#fb923c' : rgba(accent, 1) }}>
          <span className="text-3xl font-black">+</span>
          <AnimatedCounter
            value={points}
            duration={600}
            className="text-8xl font-black leading-none"
          />
        </div>
        <span className="text-xl font-bold text-white/70 -mt-3">נקודות</span>

        <AnimatePresence>
          {bonus && (
            <motion.div
              className="flex items-center gap-2.5 rounded-2xl px-5 py-2.5"
              style={{
                background: 'rgba(249,115,22,0.18)',
                border: '1px solid rgba(249,115,22,0.45)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.05, 1], opacity: 1 }}
              transition={{ scale: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.3 } }}>
              <Flame size={20} className="text-orange-400" />
              <span className="text-xl font-black text-orange-300">{mult} בונוס!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
