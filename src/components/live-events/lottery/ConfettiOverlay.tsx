import { useMemo } from 'react'
import { motion } from 'framer-motion'

const COLORS = ['#FFB800', '#FC6024', '#FF6B35', '#45CF6B', '#009090', '#FFD68A', '#FC9000']

interface ConfettiOverlayProps {
  active: boolean
  count?: number
}

export function ConfettiOverlay({ active, count = 72 }: ConfettiOverlayProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.8,
        size: 6 + Math.random() * 8,
        color: COLORS[i % COLORS.length]!,
        rotation: Math.random() * 360,
        isCircle: Math.random() > 0.5,
        xDrift: (Math.random() - 0.5) * 120,
      })),
    [count],
  )

  if (!active) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute top-[-12px]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.isCircle ? 1 : 1.4),
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
          }}
          initial={{ y: 0, opacity: 0, rotate: p.rotation, x: 0 }}
          animate={{
            y: ['0vh', '110vh'],
            opacity: [0, 1, 1, 0],
            rotate: p.rotation + 480,
            x: [0, p.xDrift],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeIn',
            repeat: Infinity,
            repeatDelay: 0.4,
          }}
        />
      ))}
    </div>
  )
}
