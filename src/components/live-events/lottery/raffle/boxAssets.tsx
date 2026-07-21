import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { RAFFLE_ASSETS, RAFFLE_SPRINGS } from './raffleTiming'

interface BoxAssetProps {
  shaking?: boolean
  glowing?: boolean
  className?: string
  /** Soft float idle (ready state). */
  idle?: boolean
}

function BoxShell({
  src,
  shaking = false,
  glowing = false,
  idle = false,
  className,
}: BoxAssetProps & { src: string }) {
  return (
    <motion.div
      className={cn(
        'relative z-20 flex items-end justify-center',
        // Same footprint across every box image so swaps never jump/resize.
        'h-[20rem] w-[21rem] sm:h-[24rem] sm:w-[26rem] md:h-[28rem] md:w-[30rem]',
        className,
      )}
      animate={
        shaking
          ? {
              x: [0, -12, 14, -16, 12, -8, 6, 0],
              y: [0, -8, 5, -10, 6, -4, 2, 0],
              rotate: [0, -7, 8, -9, 6, -4, 0],
            }
          : idle
            ? { y: [0, -5, 0], rotate: [0, -0.6, 0.6, 0] }
            : { x: 0, y: 0, rotate: 0 }
      }
      transition={
        shaking
          ? { ...RAFFLE_SPRINGS.shake, repeat: Infinity }
          : idle
            ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
            : RAFFLE_SPRINGS.idle
      }
    >
      <motion.div
        className="pointer-events-none absolute inset-[-22%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(120,90,255,0.34), rgba(60,140,255,0.2), transparent 70%)',
        }}
        animate={{
          opacity: glowing ? [0.5, 0.95, 0.5] : idle ? [0.28, 0.48, 0.28] : [0.25, 0.4, 0.25],
          scale: glowing ? [0.92, 1.12, 0.92] : [0.96, 1.04, 0.96],
        }}
        transition={{ duration: glowing ? 1.1 : 3.4, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="relative z-10 h-full w-full object-contain drop-shadow-[0_32px_64px_rgba(30,20,60,0.55)] select-none"
      />
      <div
        className="pointer-events-none absolute -bottom-1 left-1/2 h-8 w-[72%] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(90,60,200,0.35),rgba(40,120,220,0.18),transparent_72%)] blur-md"
        aria-hidden="true"
      />
    </motion.div>
  )
}

export function EmptyRaffleBox(props: BoxAssetProps) {
  return <BoxShell src={RAFFLE_ASSETS.empty} {...props} />
}

/** Open lid, no tickets — waiting to receive entries. */
export function OpenEmptyRaffleBox(props: BoxAssetProps) {
  return <BoxShell src={RAFFLE_ASSETS.openEmpty} {...props} />
}

/** Open lid with tickets inside. */
export function OpenRaffleBox(props: BoxAssetProps) {
  return <BoxShell src={RAFFLE_ASSETS.open} {...props} />
}

export function FullRaffleBox(props: BoxAssetProps) {
  return <BoxShell src={RAFFLE_ASSETS.full} {...props} />
}
