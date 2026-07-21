import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  EmptyRaffleBox,
  FullRaffleBox,
  OpenEmptyRaffleBox,
  OpenRaffleBox,
} from './boxAssets'
import { RAFFLE_TIMING, type RaffleBoxKind } from './raffleTiming'

interface RaffleBoxProps {
  kind: RaffleBoxKind
  /** During collecting — openEmpty → open (tickets appear inside). */
  filling?: boolean
  /** During closeBox — open → full lid-close crossfade. */
  closing?: boolean
  shaking?: boolean
  glowing?: boolean
  idle?: boolean
  className?: string
}

/**
 * Signature raffle box — open-empty → open-full → closed-full via Framer crossfades.
 * Stays closed for the winner reveal — the ticket exits through the box's top slot.
 */
export function RaffleBox({
  kind,
  filling = false,
  closing = false,
  shaking = false,
  glowing = false,
  idle = false,
  className,
}: RaffleBoxProps) {
  const showOpenEmpty = kind === 'openEmpty' || filling
  const showOpen = kind === 'open' || filling || closing
  const showFull = kind === 'full' || closing
  const showEmptyClosed = kind === 'empty'

  return (
    <div className={cn('relative flex items-end justify-center', className)}>
      <AnimatePresence mode="sync" initial={false}>
        {showEmptyClosed && (
          <motion.div
            key="empty-closed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <EmptyRaffleBox idle={idle} glowing={glowing} shaking={shaking} />
          </motion.div>
        )}

        {showOpenEmpty && (
          <motion.div
            key="open-empty"
            className={
              filling || showOpen || showFull
                ? 'absolute inset-0 flex items-end justify-center'
                : undefined
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: filling ? 0 : kind === 'openEmpty' ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={
              filling
                ? { duration: RAFFLE_TIMING.collecting / 1000, ease: [0.4, 0.05, 0.2, 1] }
                : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
            }
          >
            <OpenEmptyRaffleBox idle={idle && kind === 'openEmpty'} glowing={glowing} />
          </motion.div>
        )}

        {showOpen && (
          <motion.div
            key="open"
            className={
              closing || showFull
                ? 'absolute inset-0 flex items-end justify-center'
                : undefined
            }
            initial={{ opacity: filling ? 0 : kind === 'open' ? 1 : 0 }}
            animate={{
              opacity: closing ? 0 : filling || kind === 'open' ? 1 : 0,
            }}
            exit={{ opacity: 0 }}
            transition={
              filling
                ? { duration: RAFFLE_TIMING.collecting / 1000, ease: [0.4, 0.05, 0.2, 1] }
                : closing
                  ? { duration: 0.55, ease: [0.4, 0.05, 0.2, 1] }
                  : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
            }
          >
            <OpenRaffleBox glowing={glowing} />
          </motion.div>
        )}

        {showFull && (
          <motion.div
            key="full"
            initial={{ opacity: closing ? 0 : 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: closing ? 0.55 : 0.4, ease: [0.4, 0.05, 0.2, 1] }}
          >
            <FullRaffleBox glowing={glowing} shaking={shaking && !closing} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
