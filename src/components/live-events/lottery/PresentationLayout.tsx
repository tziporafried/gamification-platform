import { useEffect, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PresentationLayoutProps {
  children: ReactNode
  onExit: () => void
  className?: string
}

/** Fullscreen presentation shell — cream game stage like kiosk / שיאים. */
export function PresentationLayout({ children, onExit, className }: PresentationLayoutProps) {
  const orbs = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const colors = ['#FF6B35', '#FF9366', '#FFB800', '#FFD68A', '#50A49D', '#5FB3AA']
        return {
          id: i,
          right: `${-8 + Math.random() * 108}%`,
          top: `${-10 + Math.random() * 110}%`,
          size: `${10 + Math.random() * 16}rem`,
          color: colors[i % colors.length]!,
          opacity: 0.05 + Math.random() * 0.09,
        }
      }),
    [],
  )

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onExit])

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="מצגת הגרלה"
      dir="rtl"
      className={cn(
        'fixed inset-0 z-[100] flex flex-col overflow-hidden',
        'bg-app-radial font-sans text-foreground',
        className,
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 opacity-45 animate-ceremony-wash bg-[linear-gradient(120deg,rgba(255,147,102,0.16),rgba(255,184,0,0.12),rgba(80,164,157,0.14),rgba(255,248,243,0.1))] bg-[length:240%_240%]" />
        {orbs.map((orb) => (
          <span
            key={orb.id}
            className="absolute rounded-full blur-3xl"
            style={{
              right: orb.right,
              top: orb.top,
              width: orb.size,
              height: orb.size,
              backgroundColor: orb.color,
              opacity: orb.opacity,
            }}
          />
        ))}
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-l from-[#FF9366] via-[#FFD68A] to-[#5FB3AA]" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </motion.div>,
    document.body,
  )
}
