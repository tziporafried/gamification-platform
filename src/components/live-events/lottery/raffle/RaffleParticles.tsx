import { motion } from 'framer-motion'

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: 4 + ((i * 37) % 92),
  y: 6 + ((i * 53) % 88),
  size: 2 + (i % 4),
  delay: (i % 9) * 0.22,
  duration: 4.2 + (i % 5) * 0.55,
  color: i % 2 === 0 ? 'rgba(90,140,255,0.45)' : 'rgba(150,100,255,0.4)',
}))

interface RaffleParticlesProps {
  energetic?: boolean
}

/** Soft blue / purple atmosphere particles. */
export function RaffleParticles({ energetic = false }: RaffleParticlesProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {PARTICLES.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
          }}
          animate={{
            y: energetic ? [0, -28, 10, 0] : [0, -14, 0],
            opacity: energetic ? [0.25, 0.85, 0.35, 0.25] : [0.15, 0.5, 0.15],
            scale: energetic ? [1, 1.4, 0.9, 1] : [1, 1.15, 1],
          }}
          transition={{
            duration: energetic ? p.duration * 0.55 : p.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
          }}
        />
      ))}
    </div>
  )
}
