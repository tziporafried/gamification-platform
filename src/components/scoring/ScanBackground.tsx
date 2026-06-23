import { useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'

const PARTICLE_COUNT = 30

interface Particle {
  x: number
  y: number
  size: number
  opacity: number
  speedX: number
  speedY: number
  hue: number
}

interface ScanBackgroundProps {
  accent: AccentRgb
}

export function ScanBackground({ accent }: ScanBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)

  const baseHue = useMemo(() => {
    const r = accent.r / 255
    const g = accent.g / 255
    const b = accent.b / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    if (max !== min) {
      const d = max - min
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      else if (max === g) h = ((b - r) / d + 2) / 6
      else h = ((r - g) / d + 4) / 6
    }
    return Math.round(h * 360)
  }, [accent])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 3,
      opacity: 0.1 + Math.random() * 0.3,
      speedX: (Math.random() - 0.5) * 0.02,
      speedY: (Math.random() - 0.5) * 0.02,
      hue: baseHue + (Math.random() - 0.5) * 40,
    }))

    function resize() {
      canvas!.width = canvas!.offsetWidth * window.devicePixelRatio
      canvas!.height = canvas!.offsetHeight * window.devicePixelRatio
      ctx!.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    function animate() {
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      ctx!.clearRect(0, 0, w, h)
      for (const p of particlesRef.current) {
        p.x += p.speedX
        p.y += p.speedY
        if (p.x < 0) p.x = 100
        if (p.x > 100) p.x = 0
        if (p.y < 0) p.y = 100
        if (p.y > 100) p.y = 0
        ctx!.beginPath()
        ctx!.arc((p.x / 100) * w, (p.y / 100) * h, p.size, 0, Math.PI * 2)
        ctx!.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.opacity})`
        ctx!.fill()
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(rafRef.current) }
  }, [baseHue])

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <motion.div
        className="absolute -left-1/4 -top-1/4 h-[60vh] w-[60vh] rounded-full"
        style={{ background: `radial-gradient(circle, ${rgba(accent, 0.12)} 0%, transparent 70%)` }}
        animate={{ x: [0, 80, -40, 0], y: [0, 60, -30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute -bottom-1/4 -right-1/4 h-[50vh] w-[50vh] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)' }}
        animate={{ x: [0, -60, 40, 0], y: [0, -80, 20, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute left-1/3 top-1/4 h-[40vh] w-[40vh] rounded-full"
        style={{ background: `radial-gradient(circle, ${rgba(accent, 0.06)} 0%, transparent 70%)` }}
        animate={{ x: [0, 50, -50, 0], y: [0, -40, 60, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}
