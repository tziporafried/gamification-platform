import { motion } from 'framer-motion'
import { ConfettiOverlay } from './ConfettiOverlay'

interface WinnerRevealProps {
  winnerName: string
  prizeName: string
  prizeIcon: string
}

export function WinnerReveal({
  winnerName,
  prizeName,
  prizeIcon,
}: WinnerRevealProps) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-4 py-8">
      <ConfettiOverlay active />

      <motion.div
        className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 16 }}
      >
        <motion.div
          className="w-full rounded-[1.75rem] border-2 border-warning/35 bg-[linear-gradient(150deg,#FFFDF7,#FFF1D2)] px-6 py-10 shadow-[0_18px_54px_rgba(46,34,30,0.12)] sm:px-10"
          animate={{
            boxShadow: [
              '0 18px 54px rgba(46,34,30,0.12), 0 0 0 0 rgba(255,184,0,0)',
              '0 22px 60px rgba(46,34,30,0.14), 0 0 0 8px rgba(255,184,0,0.18)',
              '0 18px 54px rgba(46,34,30,0.12), 0 0 0 0 rgba(255,184,0,0)',
            ],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.p
            className="mb-4 text-2xl font-bold text-primary-text sm:text-3xl"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            🎉 הזוכה
          </motion.p>

          <motion.h2
            className="mb-8 text-4xl font-black leading-tight text-foreground sm:text-6xl md:text-7xl"
            style={{
              textShadow: '0 0 24px rgba(255, 184, 0, 0.35)',
            }}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            {winnerName}
          </motion.h2>

          <div className="mx-auto max-w-md rounded-2xl border border-warning/30 bg-white/78 px-8 py-5 backdrop-blur-sm">
            <p className="mb-1 text-sm font-medium text-muted">הפרס</p>
            <p className="text-2xl font-black text-foreground sm:text-3xl">
              <span className="me-2" aria-hidden>
                {prizeIcon}
              </span>
              {prizeName}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
