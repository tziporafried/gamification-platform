import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, MapPin } from 'lucide-react'
import { BrandLogo } from '@/components/icons/BrandLogo'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

/**
 * Feature announcement for trivia tasks (the `trivia_tasks` flag, now on for
 * every game).
 *
 * Same shell as LotteryAnnouncementModal: closing collapses the dialog into a
 * bubble that reopens on click, so the flag means "start collapsed" rather
 * than "never show again". Bump the version suffix to announce again.
 */
const STORAGE_KEY = 'announcement-seen:trivia-2026-11'

/** Landing, the seasonal homepages and the events list - never a live screen. */
const ALLOWED_ROUTES = new Set(['/', '/events'])

/** Drifting motes around the illustration. Positions are percentages. */
const PARTICLES = [
  { x: 10, y: 20, size: 7, color: '#FFD35C', delay: 0, duration: 5.5 },
  { x: 88, y: 14, size: 5, color: '#7FE8FF', delay: 1.2, duration: 6.4 },
  { x: 6, y: 70, size: 6, color: '#B08CFF', delay: 2.1, duration: 5.9 },
  { x: 92, y: 66, size: 8, color: '#FF9FC7', delay: 0.7, duration: 6.8 },
  { x: 50, y: 4, size: 5, color: '#8FF0C4', delay: 2.8, duration: 5.2 },
]

const CHIPS = [
  { icon: '❓', label: '3 תשובות' },
  { icon: '🖨️', label: 'כרטיס לכל תשובה' },
  { icon: '🎯', label: 'רק הנכונה מזכה' },
]

/**
 * Where the feature lives: the game wizard's tasks step ("צבירת נקודות",
 * WIZARD_STEPS in types/index.ts), then the quiet button under the task field
 * (AddTriviaButton in ActionList.tsx).
 */
const PATH_STEPS = [
  { label: 'עריכת הפעילות', background: 'var(--gradient-background)', dark: true },
  { label: 'צבירת נקודות', background: 'var(--color-secondary)', dark: false },
  // The printed card's own brick red, tinted - dark ink holds contrast on it.
  { label: 'שאלת טריוויה', background: 'color-mix(in srgb, #AB3500 14%, white)', dark: true },
]

/**
 * The printed card's colours (CARD_PALETTE in qr-cards/QrCardGenerator.tsx),
 * so the illustration shows the cards organisers will actually hold.
 */
const CARD = {
  primary: '#AB3500',
  foreground: '#2E221E',
  muted: '#7D706A',
  border: '#E7D6CF',
}

/** The sample question the illustration plays out. The first answer wins. */
const EVENT_NAME = 'מסיבת חנוכה'
const QUESTION = 'מה אוכלים בחנוכה'
const POINTS = 20
const ANSWERS = [
  { text: 'סופגניה', correct: true },
  { text: 'מצה', correct: false },
  { text: 'חלה', correct: false },
]

// The card stack's geometry, in px - the scanner moves between cards by it.
const CARD_H = 66
const CARD_GAP = 8
const QR_W = 66

// One play of the scene, then a rest on its final frame, then again - the
// lottery popup's pattern, which keeps the GPU idle between plays.
const PLAY_MS = 5600
const REST_MS = 4000

// Beats inside one play, in seconds.
const T_DEAL = 0.15 // first card lands; each next one +0.16
const T_SCAN = 1.3 // scanner appears on the bottom card, then hops upward
const T_REVEAL = 3.0 // the right card celebrates, the others dim

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function triviaAnnouncementSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Storage blocked - start collapsed so a dismissal we cannot save does not
    // re-expand the dialog on every navigation. The bubble still offers it.
    return true
  }
}

export function TriviaAnnouncementModal({ onCollapse }: { onCollapse?: () => void } = {}) {
  const { pathname } = useLocation()
  const [view, setView] = useState<'pending' | 'open' | 'collapsed'>('pending')
  // Bumped each play so the scene remounts and replays from its first beat.
  const [cycle, setCycle] = useState(0)
  // Reduced motion (or a hidden tab): render the scene's final frame, no play.
  const [still, setStill] = useState(false)

  useEffect(() => {
    setView(triviaAnnouncementSeen() ? 'collapsed' : 'open')
  }, [])

  useEffect(() => {
    if (view !== 'open') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStill(true)
      return
    }

    let timer = 0
    const play = () => {
      setStill(false)
      setCycle((c) => c + 1)
      timer = window.setTimeout(play, PLAY_MS + REST_MS)
    }
    const onVisibility = () => {
      window.clearTimeout(timer)
      if (!document.hidden) play()
    }

    play()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [view])

  function collapse() {
    setView('collapsed')
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Nothing to do - see triviaAnnouncementSeen().
    }
    onCollapse?.()
  }

  // /home/<id> are the seasonal homepages - same audience as `/`.
  if (!ALLOWED_ROUTES.has(pathname) && !pathname.startsWith('/home/')) return null

  return (
    <>
      {view === 'collapsed' && (
        <motion.div
          // Below the dialog's z-[200]; the contact button sits bottom-left.
          className="fixed bottom-5 right-4 z-[190] sm:bottom-6 sm:right-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        >
          <button
            type="button"
            onClick={() => setView('open')}
            aria-label="חדש ב-Gamify - פתיחת ההודעה על שאלות טריוויה"
            className="flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_-4px_rgba(216,48,0,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-4px_rgba(216,48,0,0.65)] motion-reduce:hover:translate-y-0 sm:gap-2.5 sm:px-4 sm:py-3"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' }}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(46,34,30,0.22)]">
              <BrandLogo alt="" className="h-[1.05rem] w-[1.05rem] object-contain" />
            </span>
            <span>חדש ב-Gamify</span>
          </button>
        </motion.div>
      )}

      <Modal
        isOpen={view === 'open'}
        onClose={collapse}
        chromeless
        placement="corner"
        title="חדש ב-Gamify: שאלות טריוויה במשחק"
        dialogClassName="max-w-[420px]"
        contentClassName="!p-0"
        overlayClassName="!bg-[rgba(40,25,20,0.18)] !backdrop-blur-0"
      >
        <div className="relative overflow-hidden">
          {/* Warm wash behind the panel - stops it reading as a white sheet. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[300px]"
            style={{
              background:
                'radial-gradient(ellipse 80% 66% at 50% 28%, rgba(255,196,90,0.20), rgba(255,196,90,0) 70%)',
            }}
          />

          {/* ---- banner + title ---- */}
          <div className="relative z-10 px-6 pt-6 text-center">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 shadow-[0_6px_18px_-6px_rgba(216,48,0,0.65)]"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(46,34,30,0.22)]">
                <BrandLogo alt="" className="h-[1.05rem] w-[1.05rem] object-contain" />
              </span>
              <span className="text-[15px] font-extrabold leading-none text-primary-foreground">חדש ב-Gamify</span>
            </span>

            <h3 className="mt-4 text-[25px] font-extrabold leading-[1.25] text-foreground sm:text-[27px]">
              שאלות טריוויה במשחק!
            </h3>
            <p className="mt-1.5 text-[14px] leading-[1.55] text-muted">
              סורקים את התשובה הנכונה - וצוברים נקודות
            </p>
          </div>

          {/* ---- illustration ---- */}
          <div
            className="relative isolate mt-3 px-6"
            role="img"
            aria-label="שלושה כרטיסי תשובה מודפסים לשאלה מה אוכלים בחנוכה. סורק עובר ביניהם ונוחת על התשובה הנכונה, סופגניה, שמזכה בעשרים נקודות"
          >
            {PARTICLES.map((p, i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full"
                style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: p.color }}
                animate={still ? { y: 0, opacity: 0.4 } : { y: [0, -14, 0], opacity: [0.25, 0.75, 0.25] }}
                transition={
                  still
                    ? { duration: 0.6 }
                    : { duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }
                }
              />
            ))}

            <TriviaScene key={cycle} still={still} />
          </div>

          {/* ---- copy ---- */}
          <div className="relative z-10 px-4 pb-6 pt-4 text-center sm:px-6">
            {/* One row down to a 360px phone: small type, tight padding. */}
            <ul className="flex flex-nowrap items-center justify-center gap-1">
              {CHIPS.map((chip) => (
                <li
                  key={chip.label}
                  className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-white/70 bg-white/55 px-1.5 py-1 text-[11px] font-semibold text-foreground shadow-[0_2px_10px_-3px_rgba(46,34,30,0.18)]"
                >
                  <span aria-hidden="true" className="text-[11px] leading-none">{chip.icon}</span>
                  {chip.label}
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-2xl border border-border bg-[var(--color-background)] px-2.5 py-4 sm:px-4 shadow-[0_2px_12px_-4px_rgba(46,34,30,0.16)]">
              <p className="flex items-center justify-center gap-1.5 text-[14px] font-bold text-primary-text">
                <MapPin size={15} strokeWidth={2.5} aria-hidden="true" />
                איפה מוצאים את זה?
              </p>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-muted">
                זמין עכשיו בכל פעילות, מתחת לשדה הוספת משימה.
              </p>
              <ol className="mt-3 flex flex-nowrap items-center justify-center gap-x-1 sm:gap-x-1.5">
                {PATH_STEPS.map((step, i) => (
                  <li key={step.label} className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                    {i > 0 && <span aria-hidden="true" className="text-[12px] text-muted">←</span>}
                    <span
                      className={cn(
                        'whitespace-nowrap rounded-lg px-1.5 py-1 text-[11px] font-semibold shadow-[0_1px_3px_rgba(46,34,30,0.14)] sm:px-2 sm:text-[12px]',
                        step.dark ? 'border border-border text-foreground' : 'text-white',
                      )}
                      style={{ background: step.background }}
                    >
                      {step.label}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}

/**
 * Three of the question's printed cards, dealt onto the table; a scanner tries
 * the bottom card, the middle one, and lands on the right answer.
 *
 * Choreography after the project's animation references: the cards deal in a
 * Jitter-style stagger (offset + rotation settling with an elastic overshoot),
 * and the winning card plays animate.style's `tada` while "+20" rises like
 * `bounceInUp`. Transforms and opacity only - no blur or filter, which would
 * cost a GPU layer per element (see the lottery popup's history).
 *
 * `still` renders the final frame at once, for reduced motion.
 */
function TriviaScene({ still }: { still: boolean }) {
  const spring = (delay: number) =>
    still ? { duration: 0 } : { delay, type: 'spring' as const, stiffness: 420, damping: 16 }
  const step = CARD_H + CARD_GAP
  // Scanner stops: bottom card, middle card, top (correct) card.
  const scanY = [2 * step, 2 * step, step, step, 0]

  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[330px]" style={{ height: 3 * CARD_H + 2 * CARD_GAP }}>
      {ANSWERS.map((a, i) => {
        const delay = T_DEAL + i * 0.16
        const tilt = [-4, 3, -2][i]
        return (
          <motion.div
            key={a.text}
            className="absolute inset-x-0"
            style={{ top: i * step, height: CARD_H }}
            initial={{ opacity: 0, y: 60, rotate: tilt * 2.5 }}
            animate={{ opacity: a.correct ? 1 : [0, 1, 1, 0.4], y: 0, rotate: 0 }}
            transition={
              still
                ? { duration: 0 }
                : {
                    opacity: a.correct
                      ? { delay, duration: 0.25 }
                      : { delay, duration: T_REVEAL - delay + 0.4, times: [0, 0.1, 0.85, 1] },
                    y: { delay, type: 'spring', stiffness: 300, damping: 17 },
                    rotate: { delay, type: 'spring', stiffness: 260, damping: 12 },
                  }
            }
          >
            <motion.div
              className="relative h-full"
              animate={
                a.correct && !still
                  ? { scale: [1, 0.95, 0.95, 1.06, 1.06, 1.06, 1.06, 1], rotate: [0, -1.5, -1.5, 1.5, -1.5, 1.5, -1.5, 0] }
                  : undefined
              }
              transition={a.correct && !still ? { delay: T_REVEAL, duration: 0.9 } : undefined}
            >
              <MiniCard answer={a.text} highlight={a.correct} reveal={still ? 0 : T_REVEAL} />

              {a.correct && (
                <>
                  <motion.span
                    className="absolute -right-2 -top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-[#2FB85A] text-white shadow-[0_2px_8px_rgba(47,184,90,0.5)]"
                    initial={{ scale: 0, rotate: -40 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={spring(T_REVEAL)}
                  >
                    <Check size={14} strokeWidth={3.5} />
                  </motion.span>
                  {/* Centred by a static wrapper: framer's transform would
                      overwrite a translate class on the animated badge itself. */}
                  <div className="pointer-events-none absolute inset-x-0 -top-4 z-20 flex justify-center">
                    <motion.span
                      dir="ltr"
                      className="whitespace-nowrap rounded-full bg-[#FFD35C] px-2.5 py-0.5 text-[14px] font-black text-[#7A4B00] shadow-[0_4px_12px_-2px_rgba(224,165,38,0.6)]"
                      initial={{ opacity: 0, y: 24, scale: 0.6 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={spring(T_REVEAL + 0.25)}
                    >
                      +{POINTS} ⭐
                    </motion.span>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )
      })}

      {/* Scanner frame over the QR side (the card's left), hopping card to card */}
      <motion.div
        className="pointer-events-none absolute left-[-5px] top-[-5px] z-10 rounded-xl border-[3px] border-dashed border-[#FF7A3D]"
        style={{ width: QR_W + 10, height: CARD_H + 10 }}
        initial={{ opacity: 0, y: scanY[0] }}
        animate={{ opacity: still ? 0 : [0, 1, 1, 0], y: still ? 0 : scanY }}
        transition={
          still
            ? { duration: 0 }
            : {
                opacity: { delay: T_SCAN, duration: T_REVEAL - T_SCAN + 0.6, times: [0, 0.08, 0.85, 1], ease: 'linear' },
                y: { delay: T_SCAN, duration: T_REVEAL - T_SCAN - 0.2, times: [0, 0.3, 0.45, 0.75, 0.92], ease: EASE_OUT },
              }
        }
      >
        <motion.span
          className="absolute inset-x-1 h-[3px] rounded-full bg-[#FF7A3D] shadow-[0_0_8px_rgba(255,122,61,0.9)]"
          initial={{ top: '12%' }}
          animate={still ? { top: '12%' } : { top: ['12%', '85%', '12%', '85%', '12%'] }}
          transition={still ? { duration: 0 } : { delay: T_SCAN, duration: T_REVEAL - T_SCAN, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  )
}

/**
 * A scaled-down printed trivia card (CardFrame + QrCard in QrCardGenerator):
 * QR side on the left behind a brick-red rule, the event, the question and the
 * answer on the right, and the points row.
 */
function MiniCard({ answer, highlight, reveal }: { answer: string; highlight: boolean; reveal: number }) {
  return (
    <div
      className="relative flex h-full overflow-hidden rounded-xl bg-white shadow-[0_6px_16px_-8px_rgba(46,34,30,0.35)]"
      style={{ direction: 'ltr', border: `1.5px solid ${CARD.border}` }}
    >
      {highlight && (
        // The green ring arrives with the reveal, not before it.
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-xl border-2 border-[#2FB85A]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reveal, duration: reveal ? 0.25 : 0 }}
        />
      )}
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: QR_W,
          borderLeft: `3px solid ${CARD.primary}`,
          background: `linear-gradient(135deg, ${CARD.primary}14 0%, ${CARD.primary}06 100%)`,
        }}
      >
        <MiniQr className="h-10 w-10" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 text-right" style={{ direction: 'rtl' }}>
        <span className="text-[9px] leading-tight" style={{ color: CARD.muted }}>{EVENT_NAME}</span>
        <span className="text-[11px] font-bold leading-tight" style={{ color: CARD.foreground }}>
          <span style={{ color: '#D9342B' }}>?</span> {QUESTION}
        </span>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-[17px] font-black leading-tight" style={{ color: CARD.foreground }}>{answer}</span>
          <span className="shrink-0 text-[11px] font-black" style={{ color: CARD.primary }}>
            ⭐ {POINTS}
          </span>
        </div>
      </div>
    </div>
  )
}

/** A tiny QR-ish glyph: three finder squares and a few modules. */
function MiniQr({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={cn('h-5 w-5 text-[#2E221E]', className)} fill="currentColor">
      <path d="M0 0h7v7H0zM2 2v3h3V2zM14 0h7v7h-7zm2 2v3h3V2zM0 14h7v7H0zm2 2v3h3v-3z" fillRule="evenodd" />
      <path d="M9 0h2v2H9zM9 4h3v2H9zM9 9h2v3H9zM13 9h3v2h-3zM18 9h3v2h-3zM9 14h2v2H9zM12 12h2v2h-2zM15 14h2v3h-2zM18 13h3v2h-3zM12 18h3v3h-3zM18 18h3v3h-3zM0 9h3v2H0zM4 10h2v2H4z" />
    </svg>
  )
}
