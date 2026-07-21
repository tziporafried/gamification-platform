import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ConfettiOverlay } from './ConfettiOverlay'

interface WinnerRevealProps {
  winnerName: string
  prizeName: string
  prizeIcon: string
}

/**
 * Premium winner celebration for the live projector stage.
 */
export function WinnerReveal({
  winnerName,
  prizeName,
  prizeIcon,
}: WinnerRevealProps) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-4 py-8">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(46,34,30,0.18),transparent_65%)]"
        aria-hidden="true"
      />
      <ConfettiOverlay active count={80} />

      <motion.div
        className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center"
        initial={{ opacity: 0, scale: 0.55 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 150, damping: 14 }}
      >
        <motion.div
          className={cn(
            'w-full rounded-[1.75rem] border border-white/50 bg-white/85 px-6 py-10',
            'shadow-[0_24px_64px_rgba(46,34,30,0.18)] backdrop-blur-md sm:px-10',
          )}
          animate={{
            boxShadow: [
              '0 24px 64px rgba(46,34,30,0.16), 0 0 0 0 rgba(69,207,107,0)',
              '0 28px 72px rgba(46,34,30,0.2), 0 0 0 10px rgba(69,207,107,0.16)',
              '0 24px 64px rgba(46,34,30,0.16), 0 0 0 0 rgba(69,207,107,0)',
            ],
          }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.p
            className="mb-3 text-2xl font-bold text-secondary-text sm:text-3xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            🎉 מזל טוב!
          </motion.p>

          <motion.div
            className={cn(
              'mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[1.5rem] text-4xl',
              'bg-gradient-to-br from-[#6ADB8A] to-[#2FB85A]',
              'shadow-[0_16px_36px_rgba(47,184,90,0.35)] sm:h-28 sm:w-28 sm:text-5xl',
            )}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.08 }}
            aria-hidden="true"
          >
            {prizeIcon || '🎁'}
          </motion.div>

          <motion.h2
            className="mb-6 text-4xl font-black leading-tight text-foreground sm:text-6xl md:text-7xl"
            style={{ textShadow: '0 0 28px rgba(69,207,107,0.28)' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 160, damping: 16 }}
          >
            {winnerName}
          </motion.h2>

          <motion.div
            className="mx-auto max-w-md rounded-2xl border border-border/60 bg-white/80 px-8 py-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <p className="mb-1 text-sm font-medium text-muted">הפרס</p>
            <p className="text-2xl font-black text-foreground sm:text-3xl">
              <span className="me-2" aria-hidden="true">
                {prizeIcon}
              </span>
              {prizeName}
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}
