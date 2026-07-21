import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Gift } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Strong audience-facing anticipation lines. */
const ANTICIPATION_MESSAGES = [
  'עוד רגע נגלה מי הזוכה!',
  'ההגרלה מתחילה בעוד רגע…',
  'זה הזמן להחזיק אצבעות!',
  'הרגע הגדול מתקרב…',
  'מי יהיה הזוכה?',
] as const

const MESSAGE_ROTATE_MS = 7_000

const FLOATING_PARTICLES = [
  { x: '-42%', y: '8%', size: 6, delay: 0, duration: 5.2 },
  { x: '48%', y: '18%', size: 4, delay: 0.8, duration: 4.6 },
  { x: '-28%', y: '72%', size: 5, delay: 1.4, duration: 5.8 },
  { x: '38%', y: '78%', size: 3, delay: 0.4, duration: 4.2 },
  { x: '8%', y: '4%', size: 4, delay: 1.1, duration: 5.4 },
  { x: '-8%', y: '88%', size: 5, delay: 1.8, duration: 4.9 },
] as const

/**
 * Idle / preparing stage for the lottery projector.
 * Live-stage atmosphere + animated anticipation copy.
 */
export function LotteryPreparingStage() {
  const reduceMotion = useReducedMotion()
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % ANTICIPATION_MESSAGES.length)
    }, MESSAGE_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [])

  const message = ANTICIPATION_MESSAGES[messageIndex]

  return (
    <motion.div
      className="relative flex flex-col items-center text-center"
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {!reduceMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
          {FLOATING_PARTICLES.map((p, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full bg-[#FC6024]/35"
              style={{
                left: `calc(50% + ${p.x})`,
                top: p.y,
                width: p.size,
                height: p.size,
              }}
              animate={{
                y: [0, -14, 0],
                opacity: [0.2, 0.55, 0.2],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: p.delay,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative mb-8 flex items-center justify-center sm:mb-9">
        {!reduceMotion && (
          <>
            <motion.span
              className="pointer-events-none absolute h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(252,96,36,0.28),transparent_68%)] sm:h-52 sm:w-52"
              animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.92, 1.06, 0.92] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />
            <motion.span
              className="pointer-events-none absolute h-36 w-36 rounded-full border border-[#FC6024]/25 sm:h-40 sm:w-40"
              animate={{ opacity: [0.2, 0.55, 0.2], scale: [1, 1.12, 1] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              aria-hidden="true"
            />
            <motion.span
              className="pointer-events-none absolute h-28 w-28 rounded-full border border-white/30 sm:h-32 sm:w-32"
              animate={{ opacity: [0.15, 0.4, 0.15], scale: [1.02, 1.18, 1.02] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
              aria-hidden="true"
            />
          </>
        )}

        <motion.div
          className={cn(
            'relative z-10 flex h-28 w-28 items-center justify-center rounded-[1.75rem] sm:h-32 sm:w-32',
            'bg-gradient-to-br from-[#FC6024] to-[#D83000]',
            'shadow-[0_20px_48px_rgba(252,96,36,0.35)]',
          )}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.55, rotate: -10 }}
          animate={
            reduceMotion
              ? { opacity: 1, scale: 1 }
              : {
                  opacity: 1,
                  rotate: 0,
                  y: [0, -10, 0],
                  scale: [1, 1.04, 1],
                  boxShadow: [
                    '0 18px 40px rgba(252,96,36,0.28)',
                    '0 26px 58px rgba(252,96,36,0.44)',
                    '0 18px 40px rgba(252,96,36,0.28)',
                  ],
                }
          }
          transition={
            reduceMotion
              ? { duration: 0.2 }
              : {
                  opacity: { type: 'spring', stiffness: 240, damping: 14 },
                  rotate: { type: 'spring', stiffness: 240, damping: 14 },
                  y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
                  scale: { duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
                  boxShadow: { duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
                }
          }
        >
          <motion.span
            className="flex"
            animate={reduceMotion ? undefined : { rotate: [0, -4, 3, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Gift
              size={52}
              strokeWidth={2.25}
              className="text-white drop-shadow-sm sm:h-14 sm:w-14"
              aria-hidden="true"
            />
          </motion.span>
        </motion.div>
      </div>

      {/* Title — whole-word zoom settle */}
      <motion.h1
        dir="rtl"
        className="text-5xl font-black tracking-tight text-foreground sm:text-6xl md:text-7xl"
        initial={
          reduceMotion
            ? false
            : { opacity: 0, scale: 2.4, rotate: -6, filter: 'blur(14px)' }
        }
        animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
        transition={
          reduceMotion
            ? { duration: 0.2 }
            : { type: 'spring', stiffness: 150, damping: 14, mass: 0.95, delay: 0.15 }
        }
      >
        הגרלה
      </motion.h1>

      {/* Rotating anticipation — varied entrance each cycle */}
      <div
        className="relative mx-auto mt-5 flex min-h-[3rem] w-full max-w-xl items-center justify-center overflow-visible sm:min-h-[3.5rem]"
        aria-live="polite"
      >
        <AnimatePresence mode="wait" initial={false}>
          <AnimatedLine
            key={`${message}-${messageIndex}`}
            text={message}
            styleIndex={messageIndex}
            reduceMotion={!!reduceMotion}
          />
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#FC6024]/70"
              animate={
                reduceMotion
                  ? { opacity: 0.5 }
                  : { opacity: [0.25, 0.95, 0.25], y: [0, -3, 0] }
              }
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.28,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

type LineAnim =
  | 'letter-up'
  | 'letter-drop'
  | 'word-pop'
  | 'slide-blur'
  | 'scale-inflate'

const LINE_ANIMS: LineAnim[] = [
  'letter-up',
  'word-pop',
  'letter-drop',
  'slide-blur',
  'scale-inflate',
]

const LINE_CLASS =
  'absolute left-1/2 whitespace-nowrap text-center text-xl font-bold text-foreground/85 sm:text-2xl'

function AnimatedLine({
  text,
  styleIndex,
  reduceMotion,
}: {
  text: string
  styleIndex: number
  reduceMotion: boolean
}) {
  const anim = LINE_ANIMS[styleIndex % LINE_ANIMS.length]

  if (reduceMotion) {
    return (
      <motion.p
        dir="rtl"
        aria-label={text}
        className={LINE_CLASS}
        initial={{ opacity: 0, x: '-50%' }}
        animate={{ opacity: 1, x: '-50%' }}
        exit={{ opacity: 0, x: '-50%' }}
        transition={{ duration: 0.15 }}
      >
        {text}
      </motion.p>
    )
  }

  if (anim === 'slide-blur') {
    return (
      <motion.p
        dir="rtl"
        aria-label={text}
        className={LINE_CLASS}
        initial={{ opacity: 0, x: 'calc(-50% + 52px)', filter: 'blur(10px)' }}
        animate={{ opacity: 1, x: '-50%', filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: 'calc(-50% - 40px)', filter: 'blur(8px)' }}
        transition={{ type: 'spring', stiffness: 220, damping: 20, mass: 0.8 }}
      >
        {text}
      </motion.p>
    )
  }

  if (anim === 'scale-inflate') {
    return (
      <motion.p
        dir="rtl"
        aria-label={text}
        className={LINE_CLASS}
        initial={{ opacity: 0, x: '-50%', scale: 1.85, rotate: -3, filter: 'blur(12px)' }}
        animate={{ opacity: 1, x: '-50%', scale: 1, rotate: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: '-50%', scale: 0.85, y: -12 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14, mass: 0.9 }}
      >
        {text}
      </motion.p>
    )
  }

  if (anim === 'word-pop') {
    const words = text.split(/(\s+)/)
    let delayStep = 0

    return (
      <motion.p
        dir="rtl"
        aria-label={text}
        className={LINE_CLASS}
        initial={{ opacity: 1, x: '-50%' }}
        animate={{ opacity: 1, x: '-50%' }}
        exit={{ opacity: 0, x: '-50%', y: -14, scale: 0.94 }}
        transition={{ duration: 0.3 }}
      >
        {words.map((word, wordIdx) => {
          if (/^\s+$/.test(word)) {
            return <span key={`sp-${wordIdx}`}>{' '}</span>
          }
          const delay = 0.05 + delayStep * 0.1
          delayStep += 1
          return (
            <motion.span
              key={`w-${wordIdx}-${word}`}
              className="inline-block"
              initial={{ opacity: 0, y: 22, scale: 0.55 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 14,
                mass: 0.55,
                delay,
              }}
            >
              {word}
            </motion.span>
          )
        })}
      </motion.p>
    )
  }

  // letter-up | letter-drop
  const fromAbove = anim === 'letter-drop'
  const words = text.split(/(\s+)/)
  let charIndex = 0

  return (
    <motion.p
      dir="rtl"
      aria-label={text}
      className={LINE_CLASS}
      initial={{ opacity: 1, x: '-50%' }}
      animate={{ opacity: 1, x: '-50%' }}
      exit={
        fromAbove
          ? { opacity: 0, x: '-50%', y: 16, filter: 'blur(6px)' }
          : { opacity: 0, x: '-50%', y: -18, scale: 0.92, filter: 'blur(6px)' }
      }
      transition={{ duration: 0.35 }}
    >
      {words.map((word, wordIdx) => {
        if (/^\s+$/.test(word)) {
          return <span key={`sp-${wordIdx}`}>{' '}</span>
        }

        const chars = Array.from(word)
        const wordStart = charIndex
        charIndex += chars.length

        return (
          <span key={`w-${wordIdx}-${word}`} className="inline-block whitespace-nowrap">
            {chars.map((char, i) => {
              const iGlobal = wordStart + i
              return (
                <motion.span
                  key={`${text}-${iGlobal}-${char}`}
                  className="inline-block"
                  initial={{
                    opacity: 0,
                    y: fromAbove ? -34 : 28,
                    scale: fromAbove ? 1.15 : 0.5,
                    rotate: fromAbove ? (iGlobal % 2 === 0 ? 8 : -8) : iGlobal % 2 === 0 ? -10 : 10,
                    filter: 'blur(8px)',
                  }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)' }}
                  transition={{
                    type: 'spring',
                    stiffness: fromAbove ? 300 : 340,
                    damping: fromAbove ? 12 : 16,
                    mass: 0.6,
                    delay: 0.04 + iGlobal * 0.028,
                  }}
                >
                  {char}
                </motion.span>
              )
            })}
          </span>
        )
      })}
    </motion.p>
  )
}
