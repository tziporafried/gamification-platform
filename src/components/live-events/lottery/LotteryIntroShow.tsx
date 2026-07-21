import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { Gift } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface IntroRuleCard {
  id: 'prize' | 'participants'
  icon: string
  label: string
  value: string
}

interface LotteryIntroShowProps {
  cards: IntroRuleCard[]
  onBeat?: (beat: IntroBeat) => void
  /** Optional — draw is gated by intro bed audio end, not this callback. */
  onComplete?: () => void
}

export type IntroBeat =
  | 'ready'
  | 'prize'
  | 'participants'
  | 'ask'
  | 'count3'
  | 'count2'
  | 'count1'
  | 'flash'
  | 'blast'

type IntroPhase =
  | 'ready'
  | 'prize'
  | 'participants'
  | 'ask'
  | 'count3'
  | 'count2'
  | 'count1'
  | 'flash'
  | 'blast'

/** Intro pacing aligned to ~20s intro bed (from prize beat). */
const HOLD: Record<IntroPhase, number> = {
  ready: 2_800,
  prize: 4_500,
  participants: 4_500,
  ask: 3_000,
  count3: 2_100,
  count2: 2_100,
  count1: 1_900,
  flash: 520,
  blast: 960,
}

const NEXT: Partial<Record<IntroPhase, IntroPhase>> = {
  ready: 'prize',
  prize: 'participants',
  participants: 'ask',
  ask: 'count3',
  count3: 'count2',
  count2: 'count1',
  count1: 'flash',
  flash: 'blast',
}

const BLAST_OUT = { duration: 0.78, ease: [0.4, 0, 0.7, 0.15] as const }

/** Animate.css–inspired bounceOutUp (see https://animate.style/). */
const READY_EXIT_EASE = [0.34, 1.56, 0.64, 1] as const
const readyStageVariants = {
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0 },
  },
  exit: {
    transition: { staggerChildren: 0.07, staggerDirection: -1 as const },
  },
}
const readyItemVariants = {
  show: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: {
    opacity: 0,
    y: -160,
    scale: 0.45,
    filter: 'blur(10px)',
    transition: { duration: 0.58, ease: READY_EXIT_EASE },
  },
}

/** Animate.css–inspired bounceInUp for the first rules card. */
const CARD_IN_UP = {
  initial: { opacity: 0, y: 96, scale: 0.86 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: 'spring' as const, stiffness: 280, damping: 16, mass: 0.75 },
}

/** Softer, slower motion than typical UI springs. */
const SPRING = { type: 'spring' as const, stiffness: 90, damping: 20 }

/** Scan mission-card language: peach frame, floating badge, white content. */
const CARD_TONES = {
  prize: {
    frame: 'linear-gradient(145deg, #FFB888, #FF9A5C)',
    badge: 'linear-gradient(90deg, #FF9366, #F2B33C)',
    badgeShadow: '0 6px 22px rgba(255,147,102,0.45), 0 0 0 4px rgba(255,255,255,0.95)',
    iconRing: 'rgba(255,100,40,0.75)',
    iconGlow: 'rgba(255,147,102,0.4)',
    ink: '#2E221E',
  },
  participants: {
    frame: 'linear-gradient(145deg, #7ED4D4, #009090)',
    badge: 'linear-gradient(90deg, #2AA6A6, #5AB5AD)',
    badgeShadow: '0 6px 22px rgba(0,144,144,0.38), 0 0 0 4px rgba(255,255,255,0.95)',
    iconRing: 'rgba(0,144,144,0.7)',
    iconGlow: 'rgba(0,144,144,0.35)',
    ink: '#2E221E',
  },
  winners: {
    frame: 'linear-gradient(145deg, #F2B33C, #E8A33D)',
    badge: 'linear-gradient(90deg, #F2B33C, #FFD68A)',
    badgeShadow: '0 6px 22px rgba(242,179,60,0.42), 0 0 0 4px rgba(255,255,255,0.95)',
    iconRing: 'rgba(200,140,30,0.75)',
    iconGlow: 'rgba(242,179,60,0.4)',
    ink: '#2E221E',
  },
} as const

type CardTone = 'prize' | 'participants'

function beatForPhase(phase: IntroPhase): IntroBeat {
  return phase
}

/**
 * Continuous cinematic lottery introduction - one story, not separate screens.
 */
export function LotteryIntroShow({
  cards,
  onBeat,
}: LotteryIntroShowProps) {
  const reduceMotion = useReducedMotion()
  const [phase, setPhase] = useState<IntroPhase>('ready')
  const onBeatRef = useRef(onBeat)
  onBeatRef.current = onBeat

  const prize = cards.find((c) => c.id === 'prize')!
  const participants = cards.find((c) => c.id === 'participants')!

  const inFinale = phase === 'flash' || phase === 'blast'
  const inCountdown =
    phase === 'count3' ||
    phase === 'count2' ||
    phase === 'count1' ||
    inFinale
  const afterParticipants =
    phase === 'participants' || phase === 'ask' || inCountdown
  const showPrize = phase === 'prize' || afterParticipants
  const showParticipants = afterParticipants
  const isLifted = phase === 'ask' || inCountdown
  const showAsk = phase === 'ask' || inCountdown
  const isBlasting = phase === 'blast'

  useEffect(() => {
    onBeatRef.current?.(beatForPhase(phase))

    // After blast, hold empty stage until intro bed audio ends (parent advances).
    if (phase === 'blast') return

    const next = NEXT[phase]
    if (!next) return
    const t = window.setTimeout(() => setPhase(next), HOLD[phase])
    return () => window.clearTimeout(t)
  }, [phase])

  const countLabel =
    phase === 'count3'
      ? '3'
      : phase === 'count2'
        ? '2'
        : phase === 'count1' || phase === 'flash' || phase === 'blast'
          ? '1'
          : null

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-4',
        'pt-10 pb-6 sm:pt-12 sm:pb-8',
        'transition-[filter] duration-700',
      )}
      style={{
        filter: phase === 'ready' ? undefined : 'brightness(0.96)',
      }}
    >
      {/* Full-stage flash after "1" */}
      <AnimatePresence>
        {phase === 'flash' && (
          <motion.div
            key="stage-flash"
            className="pointer-events-none absolute inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{
              opacity: reduceMotion ? [0, 0.85, 0] : [0, 1, 0.15, 1, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0.35 : 0.48,
              times: reduceMotion ? [0, 0.45, 1] : [0, 0.18, 0.38, 0.62, 1],
              ease: 'easeInOut',
            }}
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-white" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(252,96,36,0.55),transparent_70%)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Soft stage atmosphere */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(46,34,30,0.14),transparent_62%)]"
        animate={{ opacity: phase === 'ready' ? 0.35 : isBlasting ? 0 : 0.7 }}
        transition={{ duration: 0.8 }}
        aria-hidden="true"
      />
      {!reduceMotion && !isBlasting && (
        <>
          <motion.span
            className="pointer-events-none absolute h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(252,96,36,0.18),transparent_68%)]"
            animate={{ opacity: [0.35, 0.65, 0.35], scale: [0.92, 1.06, 0.92] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-[#FC6024]/40"
              style={{
                left: `${18 + i * 16}%`,
                top: `${22 + (i % 3) * 18}%`,
              }}
              animate={{ y: [0, -10, 0], opacity: [0.2, 0.55, 0.2] }}
              transition={{
                duration: 3.2 + i * 0.35,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.25,
              }}
              aria-hidden="true"
            />
          ))}
        </>
      )}

      <AnimatePresence mode="wait">
        {/* Ready hero — exits with bounceOutUp, then first card bounceInUp */}
        {phase === 'ready' ? (
          <motion.div
            key="ready"
            className="relative z-10 flex flex-col items-center text-center"
            variants={readyStageVariants}
            initial="show"
            animate="show"
            exit="exit"
          >
            <motion.div variants={readyItemVariants}>
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.55, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0.2 }
                    : { type: 'spring', stiffness: 260, damping: 14, mass: 0.7 }
                }
              >
                <motion.div
                  className={cn(
                    'mb-6 flex h-36 w-36 items-center justify-center rounded-[2rem] sm:h-40 sm:w-40',
                    'bg-gradient-to-br from-[#FC6024] to-[#D83000]',
                  )}
                  animate={
                    reduceMotion
                      ? undefined
                      : {
                          scale: [1, 1.05, 1],
                          boxShadow: [
                            '0 18px 40px rgba(252,96,36,0.3)',
                            '0 24px 56px rgba(252,96,36,0.48)',
                            '0 18px 40px rgba(252,96,36,0.3)',
                          ],
                        }
                  }
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.55 }}
                  style={{ boxShadow: '0 20px 48px rgba(252,96,36,0.38)' }}
                >
                  <Gift size={68} className="text-white" strokeWidth={2.25} aria-hidden="true" />
                </motion.div>
              </motion.div>
            </motion.div>

            <motion.div variants={readyItemVariants}>
              <motion.h1
                dir="rtl"
                className="text-5xl font-black tracking-tight text-foreground sm:text-6xl md:text-7xl"
                initial={
                  reduceMotion
                    ? false
                    : { opacity: 0, scale: 2.1, rotate: -8, filter: 'blur(16px)' }
                }
                animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
                transition={
                  reduceMotion
                    ? { duration: 0.2 }
                    : {
                        type: 'spring',
                        stiffness: 160,
                        damping: 14,
                        mass: 0.9,
                        delay: 0.2,
                      }
                }
              >
                הגרלה
              </motion.h1>
            </motion.div>

            <motion.div variants={readyItemVariants}>
              <LetterCascade
                text="הכל מוכן…"
                as="p"
                variant="slide"
                reduceMotion={!!reduceMotion}
                delay={0.55}
                className="mt-4 text-3xl font-black text-foreground sm:text-4xl md:text-5xl"
              />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="intro-main"
            className="relative z-10 flex w-full flex-col items-center"
            initial={reduceMotion ? false : CARD_IN_UP.initial}
            animate={CARD_IN_UP.animate}
            transition={reduceMotion ? { duration: 0.2 } : CARD_IN_UP.transition}
          >
            <LayoutGroup>
              <AnimatePresence mode="sync">
                {/* Rule cards */}
                {showPrize && (
                  <motion.div
                    key="stage-cards"
                    className="relative z-10 flex w-full max-w-2xl origin-center flex-col items-stretch gap-3 sm:max-w-3xl sm:gap-4"
                    initial={false}
                    animate={
                      isBlasting
                        ? { opacity: 1 }
                        : isLifted
                          ? { y: 0, scale: 0.78, opacity: 1 }
                          : showParticipants
                            ? { y: 0, scale: 0.9, opacity: 1 }
                            : { y: 0, scale: 1, opacity: 1 }
                    }
                    transition={isBlasting ? BLAST_OUT : SPRING}
                  >
                    {showPrize && (
                      <motion.div
                        animate={
                          isBlasting
                            ? {
                                x: 160,
                                y: -280,
                                rotate: 18,
                                scale: 0.35,
                                opacity: 0,
                                filter: 'blur(10px)',
                              }
                            : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }
                        }
                        transition={BLAST_OUT}
                      >
                        <RuleCard
                          layoutId="intro-prize"
                          icon={prize.icon}
                          label={prize.label === 'פרס' ? 'הפרס' : prize.label}
                          value={prize.value}
                          tone="prize"
                          featured={phase === 'prize'}
                        />
                      </motion.div>
                    )}
                    {showParticipants && (
                      <motion.div
                        animate={
                          isBlasting
                            ? {
                                x: -180,
                                y: -160,
                                rotate: -22,
                                scale: 0.3,
                                opacity: 0,
                                filter: 'blur(10px)',
                              }
                            : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }
                        }
                        transition={{ ...BLAST_OUT, delay: 0.04 }}
                      >
                        <RuleCard
                          layoutId="intro-participants"
                          icon={participants.icon}
                          label="מי משתתף?"
                          value={participants.value}
                          tone="participants"
                          featured={phase === 'participants'}
                        />
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {showAsk && (
                  <WordBounceAskText blasting={isBlasting} reduceMotion={!!reduceMotion} />
                )}

                {inCountdown && (
                  <div
                    className="relative z-20 mt-0 flex h-[min(28vw,9.5rem)] w-full shrink-0 items-center justify-center sm:h-[11rem] md:h-[12.5rem]"
                    aria-live="polite"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {countLabel && (
                        <motion.p
                          key={`count-${countLabel}`}
                          className="absolute inset-0 flex items-center justify-center font-black tabular-nums"
                          style={{
                            fontSize: 'clamp(4.5rem, 18vw, 10rem)',
                            color:
                              countLabel === '3'
                                ? '#FC6024'
                                : countLabel === '2'
                                  ? '#009090'
                                  : '#E8A33D',
                            textShadow:
                              countLabel === '3'
                                ? '0 0 56px rgba(252,96,36,0.55)'
                                : countLabel === '2'
                                  ? '0 0 56px rgba(0,144,144,0.5)'
                                  : '0 0 56px rgba(232,163,61,0.55)',
                          }}
                          initial={{ opacity: 0, scale: 0.55, filter: 'blur(8px)' }}
                          animate={
                            isBlasting
                              ? { opacity: 0, scale: 2.4, y: -120, filter: 'blur(16px)' }
                              : { opacity: 1, scale: [0.55, 1.08, 1], filter: 'blur(0px)', y: 0 }
                          }
                          exit={{ opacity: 0, scale: 0.88, filter: 'blur(6px)' }}
                          transition={
                            isBlasting
                              ? BLAST_OUT
                              : { type: 'spring', stiffness: 120, damping: 18 }
                          }
                        >
                          {countLabel}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </AnimatePresence>
            </LayoutGroup>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type LetterVariant = 'cascade' | 'slide'

function LetterCascade({
  text,
  className,
  variant = 'cascade',
  reduceMotion,
  delay = 0,
  as: Tag = 'p',
}: {
  text: string
  className?: string
  variant?: LetterVariant
  reduceMotion: boolean
  delay?: number
  as?: 'h1' | 'p' | 'span'
}) {
  const chars = Array.from(text)
  const stagger = variant === 'slide' ? 0.038 : 0.048

  const initialFor = () => {
    if (reduceMotion) return { opacity: 1, y: 0, x: 0, scale: 1, rotate: 0, filter: 'blur(0px)' }
    if (variant === 'slide') {
      return { opacity: 0, y: 36, x: 18, scale: 0.92, rotate: 0, filter: 'blur(8px)' }
    }
    return { opacity: 0, y: -56, scale: 0.45, rotate: -12, filter: 'blur(10px)' }
  }

  const transitionFor = (i: number) => {
    if (reduceMotion) return { duration: 0.15 }
    if (variant === 'slide') {
      return {
        type: 'spring' as const,
        stiffness: 220,
        damping: 20,
        mass: 0.7,
        delay: delay + i * stagger,
      }
    }
    return {
      type: 'spring' as const,
      stiffness: 380,
      damping: 14,
      mass: 0.65,
      delay: delay + i * stagger,
    }
  }

  return (
    <Tag
      dir="rtl"
      aria-label={text}
      className={cn('flex flex-wrap items-center justify-center', className)}
    >
      {chars.map((char, i) => (
        <motion.span
          key={`${text}-${i}-${char}`}
          className="inline-block"
          style={{ whiteSpace: char === ' ' ? 'pre' : undefined }}
          initial={initialFor()}
          animate={{
            opacity: 1,
            y: 0,
            x: 0,
            scale: 1,
            rotate: 0,
            filter: 'blur(0px)',
          }}
          transition={transitionFor(i)}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </Tag>
  )
}

/**
 * Giant full-stage zoom-in that settles into place, then color flashes.
 */
function WordBounceAskText({
  blasting,
  reduceMotion,
}: {
  blasting: boolean
  reduceMotion: boolean
}) {
  const flashColors = ['#FC6024', '#009090', '#E8A33D', '#D83000', '#2AA6A6'] as const

  return (
    <motion.div
      key="ask"
      className="pointer-events-none relative z-30 mt-4 flex w-full shrink-0 justify-center sm:mt-5"
      animate={
        blasting
          ? { opacity: 0, y: -200, scale: 1.35, filter: 'blur(12px)', rotate: -6 }
          : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', rotate: 0 }
      }
      transition={blasting ? { ...BLAST_OUT, delay: 0.06 } : undefined}
    >
      <motion.p
        dir="rtl"
        aria-label="כולם מוכנים?"
        className="relative bg-transparent text-center font-black leading-none tracking-tight"
        style={{ fontSize: 'clamp(2.75rem, 9vw, 5.5rem)' }}
        initial={
          reduceMotion
            ? false
            : {
                opacity: 0,
                scale: 6.2,
                rotate: -4,
                filter: 'blur(14px)',
                color: '#2E221E',
                textShadow: '0 0 0 transparent',
              }
        }
        animate={
          blasting
            ? undefined
            : reduceMotion
              ? { opacity: 1, scale: 1, color: '#2E221E' }
              : {
                  opacity: 1,
                  scale: 1,
                  rotate: 0,
                  filter: 'blur(0px)',
                  color: ['#2E221E', ...flashColors, '#2E221E'],
                  textShadow: [
                    '0 0 0 transparent',
                    '0 0 18px rgba(252,96,36,0.85)',
                    '0 0 18px rgba(0,144,144,0.8)',
                    '0 0 18px rgba(232,163,61,0.85)',
                    '0 0 18px rgba(216,48,0,0.75)',
                    '0 0 18px rgba(42,166,166,0.75)',
                    '0 0 12px rgba(252,96,36,0.45)',
                  ],
                }
        }
        transition={
          reduceMotion
            ? { duration: 0.25 }
            : {
                scale: { type: 'spring', stiffness: 78, damping: 13, mass: 1.15, delay: 0.05 },
                opacity: { type: 'spring', stiffness: 78, damping: 13, mass: 1.15, delay: 0.05 },
                rotate: { type: 'spring', stiffness: 78, damping: 13, mass: 1.15, delay: 0.05 },
                filter: { type: 'spring', stiffness: 78, damping: 13, mass: 1.15, delay: 0.05 },
                color: {
                  duration: 2.8,
                  times: [0, 0.16, 0.32, 0.48, 0.64, 0.8, 1],
                  repeat: Infinity,
                  delay: 1.05,
                  ease: 'easeInOut',
                },
                textShadow: {
                  duration: 2.8,
                  times: [0, 0.16, 0.32, 0.48, 0.64, 0.8, 1],
                  repeat: Infinity,
                  delay: 1.05,
                  ease: 'easeInOut',
                },
              }
        }
      >
        כולם מוכנים?
      </motion.p>
    </motion.div>
  )
}

function RuleCard({
  layoutId,
  icon,
  label,
  value,
  tone,
  featured,
}: {
  layoutId: string
  icon: string
  label: string
  value: string
  tone: CardTone
  featured: boolean
}) {
  const palette = CARD_TONES[tone]
  return (
    <motion.div
      layout
      layoutId={layoutId}
      className={cn('relative overflow-visible', featured ? 'pt-4' : 'pt-3')}
      initial={{ opacity: 0, y: 48, filter: 'blur(12px)', scale: 0.92 }}
      animate={{
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        scale: featured ? 1 : 0.99,
      }}
      transition={SPRING}
    >
      {/* Peach/tone frame — scan mission outer */}
      <div
        className={cn(
          'relative rounded-[1.85rem] shadow-[0_18px_44px_rgba(120,50,10,0.18)]',
          featured ? 'p-3 pt-6 sm:p-3.5 sm:pt-7' : 'p-2 pt-4 sm:p-2.5 sm:pt-5',
        )}
        style={{ background: palette.frame }}
      >
        {/* Floating type badge — like "משימה מומלצת" */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-[42%]"
          aria-hidden="true"
        >
          <span
            className={cn(
              'inline-block whitespace-nowrap rounded-full font-black tracking-wide text-white',
              featured
                ? 'px-6 py-2 text-base sm:text-lg'
                : 'px-3.5 py-1 text-xs sm:text-sm',
            )}
            style={{
              background: palette.badge,
              boxShadow: palette.badgeShadow,
            }}
          >
            {label}
          </span>
        </div>

        {/* Floating icon badge — top corner */}
        <motion.div
          className={cn(
            'absolute z-30 flex items-center justify-center rounded-full bg-gradient-to-br from-white to-[#FFF4EC]',
            featured
              ? '-right-4 -top-4 h-[4.75rem] w-[4.75rem] sm:h-20 sm:w-20'
              : '-right-2.5 -top-2.5 h-12 w-12 sm:h-14 sm:w-14',
          )}
          style={{
            border: `3px solid ${palette.iconRing}`,
            boxShadow: `0 10px 26px rgba(120,50,10,0.28), 0 0 0 4px rgba(255,255,255,0.9), 0 0 18px ${palette.iconGlow}`,
          }}
          animate={
            featured
              ? { y: [0, -5, 0], scale: [1, 1.04, 1] }
              : undefined
          }
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        >
          <span className={featured ? 'text-4xl sm:text-5xl' : 'text-xl sm:text-2xl'}>
            {icon}
          </span>
        </motion.div>

        {/* White content panel */}
        <div
          className={cn(
            'relative rounded-[1.45rem] border border-[#FFD8BC] bg-white text-center',
            'shadow-[0_10px_24px_rgba(120,50,10,0.1)]',
            featured
              ? 'px-7 py-10 sm:px-10 sm:py-12'
              : 'px-5 py-4 sm:px-6 sm:py-5',
          )}
        >
          <p
            className={cn(
              'whitespace-nowrap font-black leading-tight',
              featured
                ? value.length > 14
                  ? 'text-3xl sm:text-4xl md:text-5xl'
                  : 'text-5xl sm:text-6xl md:text-7xl'
                : value.length > 14
                  ? 'text-base sm:text-lg md:text-xl'
                  : 'text-xl sm:text-2xl md:text-3xl',
            )}
            style={{ color: palette.ink }}
          >
            {value}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

