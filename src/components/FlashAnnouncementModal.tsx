import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { BrandLogo } from '@/components/icons/BrandLogo'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

/**
 * Feature announcement for the flash challenge ("אתגר בזק", the
 * `flash_challenge` flag).
 *
 * Same shell as TriviaAnnouncementModal and LotteryAnnouncementModal: closing
 * collapses the dialog into a bubble that reopens on click, so the flag means
 * "start collapsed" rather than "never show again". Bump the version suffix to
 * announce again.
 */
const STORAGE_KEY = 'announcement-seen:flash-2026-11'

/** Landing, the seasonal homepages and the events list - never a live screen. */
const ALLOWED_ROUTES = new Set(['/', '/events'])

/** Drifting motes around the illustration. Positions are percentages. */
const PARTICLES = [
  { x: 8, y: 18, size: 7, color: '#FFD35C', delay: 0, duration: 5.5 },
  { x: 90, y: 12, size: 5, color: '#FF9FC7', delay: 1.2, duration: 6.4 },
  { x: 5, y: 72, size: 6, color: '#7FE8FF', delay: 2.1, duration: 5.9 },
  { x: 93, y: 68, size: 8, color: '#8FF0C4', delay: 0.7, duration: 6.8 },
  { x: 50, y: 2, size: 5, color: '#B08CFF', delay: 2.8, duration: 5.2 },
]

const CHIPS = [
  { icon: '⏱️', label: 'שעון חי' },
  { icon: '🏃', label: 'בונוס לזריזים' },
  { icon: '🖨️', label: 'בלי הדפסה חדשה' },
]

/**
 * Where the feature lives: the control centre's live-events card, then the
 * flash challenge's own card (LIVE_EVENT_CATALOG in live-events/types.ts).
 */
const PATH_STEPS = [
  { label: 'לוח הבקרה', background: 'var(--gradient-background)', dark: true },
  { label: 'הפעלות בזמן אמת', background: 'var(--color-secondary)', dark: false },
  // The flash card's own red (LiveEventLibraryCard ACCENT_ICON.danger), tinted
  // so dark ink holds its contrast.
  { label: 'אתגר בזק', background: 'color-mix(in srgb, #FF4D4D 16%, white)', dark: true },
]

/** The sample challenge the illustration plays out. */
const TITLE = 'שירו את ההמנון'
const COMPLETERS = [
  { name: 'שרה', points: 80, medal: '🥇' },
  { name: 'שלמה', points: 70, medal: '🥈' },
  { name: 'רות', points: 60, medal: '🥉' },
]
/** The countdown the card shows, one second per beat. */
const CLOCK = ['0:12', '0:11', '0:10', '0:09', '0:08']

// One play, then a rest on its final frame, then again - the other popups'
// pattern, which keeps the GPU idle between plays.
const PLAY_MS = 5600
const REST_MS = 4000

// Beats inside one play, in seconds.
const T_CARD = 0.15 // the card lands
const T_ROWS = 1.4 // first completer slides in; each next one +0.75
const ROW_GAP = 0.75
const T_TICK = 0.9 // the clock starts ticking; one second per number

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function flashAnnouncementSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Storage blocked - start collapsed so a dismissal we cannot save does not
    // re-expand the dialog on every navigation. The bubble still offers it.
    return true
  }
}

export function FlashAnnouncementModal({ onCollapse }: { onCollapse?: () => void } = {}) {
  const { pathname } = useLocation()
  const [view, setView] = useState<'pending' | 'open' | 'collapsed'>('pending')
  // Bumped each play so the scene remounts and replays from its first beat.
  const [cycle, setCycle] = useState(0)
  // Reduced motion (or a hidden tab): render the scene's final frame, no play.
  const [still, setStill] = useState(false)

  useEffect(() => {
    setView(flashAnnouncementSeen() ? 'collapsed' : 'open')
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
      // Nothing to do - see flashAnnouncementSeen().
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
            aria-label="חדש ב-Gamify - פתיחת ההודעה על אתגר בזק"
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
        title="חדש ב-Gamify: אתגר בזק"
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
                'radial-gradient(ellipse 80% 66% at 50% 28%, rgba(255,150,90,0.20), rgba(255,150,90,0) 70%)',
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
              ⚡ אתגר בזק!
            </h3>
            <p className="mt-1.5 text-[14px] leading-[1.55] text-muted">
              אתגר פתע עם שעון - מי שמשלים סורק את הכרטיס שלו וזוכה בנקודות
            </p>
          </div>

          {/* ---- illustration ---- */}
          <div
            className="relative isolate mt-4 px-6"
            role="img"
            aria-label="כרטיס אתגר בזק עם שעון שסופר לאחור, ושלושה משתתפים שהשלימו את האתגר ומקבלים מדליות ונקודות - הראשון הכי הרבה"
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

            <FlashScene key={cycle} still={still} />
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
                בזמן המשחק, מתוך הפעלות בזמן אמת - והאתגר רץ על מסך הסריקה.
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
 * The challenge as the scan screen shows it: the card from the orange panel
 * (badge, title, ticking clock, points pill), and under it the completers
 * arriving one by one with their medals and the points each one won.
 *
 * Choreography after the project's animation references: the card lands with
 * animate.style's `bounceIn` overshoot, the clock's digits swap with a short
 * `heartBeat` pulse, and each completer row slides in Jitter-style (offset +
 * spring) while its "+points" pops like `bounceInUp`. Transforms and opacity
 * only - no blur or filter (see the lottery popup's history).
 *
 * `still` renders the final frame at once, for reduced motion.
 */
function FlashScene({ still }: { still: boolean }) {
  const [tick, setTick] = useState(still ? CLOCK.length - 1 : 0)

  useEffect(() => {
    if (still) {
      setTick(CLOCK.length - 1)
      return
    }
    const timers: number[] = []
    for (let i = 1; i < CLOCK.length; i++) {
      timers.push(window.setTimeout(() => setTick(i), (T_TICK + i) * 1000))
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [still])

  const urgent = tick >= 2 // 0:10 and below, as on the scan screen

  return (
    <div aria-hidden="true" className="relative mx-auto flex w-full max-w-[330px] flex-col gap-5">
      {/* The challenge card */}
      <motion.div
        className="relative mt-3 rounded-2xl bg-white px-4 pb-4 pt-6 text-center shadow-[0_10px_24px_-8px_rgba(120,50,10,0.35)]"
        style={{ border: `2px solid ${urgent ? 'rgba(216,32,16,0.55)' : 'rgba(255,120,50,0.55)'}` }}
        initial={still ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={still ? { duration: 0 } : { delay: T_CARD, type: 'spring', stiffness: 320, damping: 13 }}
      >
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-black text-white shadow-[0_4px_10px_-2px_rgba(216,48,0,0.5)]"
          style={{ background: urgent ? 'linear-gradient(135deg,#FF5A3C,#D82010)' : 'linear-gradient(135deg,#FF9366,#EF6A2E)' }}
        >
          ⚡ אתגר בזק
        </span>
        <span
          className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[22px] shadow-[0_6px_14px_-4px_rgba(120,50,10,0.4)]"
          style={{ border: '2.5px solid rgba(255,100,40,0.75)' }}
        >
          ⚡
        </span>

        <div className="text-[17px] font-black text-foreground">{TITLE}</div>
        <motion.div
          key={tick}
          dir="ltr"
          className="mt-1 text-[30px] font-black leading-none tabular-nums"
          style={{ color: urgent ? '#D82010' : '#D45A1A' }}
          initial={still || tick === 0 ? false : { scale: 1.25 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14 }}
        >
          {CLOCK[tick]}
        </motion.div>

        <span
          className="absolute -bottom-3 -left-3 whitespace-nowrap rounded-full bg-[#FFF4E0] px-2.5 py-1 text-[14px] font-black text-[#C8941A] shadow-[0_4px_12px_-2px_rgba(242,179,60,0.55)]"
          style={{ border: '2px solid rgba(242,179,60,0.9)' }}
          dir="ltr"
        >
          ⭐ +50
        </span>
      </motion.div>

      {/* Who made it, in order */}
      <ol className="flex flex-col gap-1.5">
        {COMPLETERS.map((c, i) => {
          const delay = T_ROWS + i * ROW_GAP
          return (
            <motion.li
              key={c.name}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 shadow-[0_4px_12px_-6px_rgba(120,50,10,0.35)]"
              style={{ border: '1.5px solid #FFD68A' }}
              initial={still ? false : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={still ? { duration: 0 } : { delay, type: 'spring', stiffness: 320, damping: 20 }}
            >
              <span className="text-[17px] leading-none">{c.medal}</span>
              <span className="flex-1 text-right text-[14px] font-black text-foreground">{c.name}</span>
              <motion.span
                dir="ltr"
                className="rounded-full bg-[#FFD35C] px-2 py-0.5 text-[12px] font-black text-[#7A4B00]"
                initial={still ? false : { opacity: 0, y: 12, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={still ? { duration: 0 } : { delay: delay + 0.25, type: 'spring', stiffness: 420, damping: 14 }}
              >
                +{c.points}
              </motion.span>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}
