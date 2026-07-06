import { useEffect, useState } from 'react'

type FloatAnim = 'app-floatY-1' | 'app-floatY-2' | 'app-floatY-3' | 'app-floatY-4'

interface FloatingShape {
  top?: string
  bottom?: string
  left?: string
  right?: string
  width: number
  height: number
  borderRadius: number | '50%'
  color: string
  anim: FloatAnim
}

/** Kiosk-matched palette — circles and rounded squares scattered across the viewport. */
const FLOATING_SHAPES: FloatingShape[] = [
  { top: '6%', right: '10%', width: 16, height: 16, borderRadius: 5, color: '#F2B33C', anim: 'app-floatY-1' },
  { top: '14%', left: '7%', width: 14, height: 14, borderRadius: '50%', color: '#5FB3AA', anim: 'app-floatY-2' },
  { top: '22%', right: '22%', width: 13, height: 13, borderRadius: '50%', color: '#FF9366', anim: 'app-floatY-3' },
  { top: '34%', left: '18%', width: 18, height: 18, borderRadius: 6, color: '#8FCFA0', anim: 'app-floatY-4' },
  { top: '42%', right: '6%', width: 12, height: 12, borderRadius: '50%', color: '#FFB84D', anim: 'app-floatY-1' },
  { top: '52%', left: '4%', width: 12, height: 12, borderRadius: 5, color: '#FFCB9A', anim: 'app-floatY-2' },
  { top: '58%', right: '16%', width: 15, height: 15, borderRadius: '50%', color: '#5FB3AA', anim: 'app-floatY-3' },
  { top: '66%', left: '12%', width: 14, height: 14, borderRadius: 5, color: '#F2B33C', anim: 'app-floatY-4' },
  { bottom: '28%', right: '8%', width: 16, height: 16, borderRadius: 6, color: '#8FCFA0', anim: 'app-floatY-1' },
  { bottom: '20%', left: '20%', width: 13, height: 13, borderRadius: '50%', color: '#FF9366', anim: 'app-floatY-2' },
  { bottom: '12%', right: '28%', width: 12, height: 12, borderRadius: '50%', color: '#FFB84D', anim: 'app-floatY-3' },
  { bottom: '8%', left: '8%', width: 18, height: 18, borderRadius: 6, color: '#FFCB9A', anim: 'app-floatY-4' },
]

function FloatingShapeItem({ shape, reducedMotion }: { shape: FloatingShape; reducedMotion: boolean }) {
  const { top, bottom, left, right, width, height, borderRadius, color, anim } = shape

  return (
    <div
      className={reducedMotion ? undefined : anim}
      style={{
        position: 'absolute',
        top,
        bottom,
        left,
        right,
        width,
        height,
        borderRadius,
        background: color,
        opacity: reducedMotion ? 0.55 : 1,
      }}
    />
  )
}

export function FloatingIconsBackground() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    function onChange(e: MediaQueryListEvent) {
      setReducedMotion(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {FLOATING_SHAPES.map((shape, i) => (
        <FloatingShapeItem key={i} shape={shape} reducedMotion={reducedMotion} />
      ))}
    </div>
  )
}
