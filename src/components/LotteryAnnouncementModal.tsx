import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { BrandLogo } from '@/components/icons/BrandLogo'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

/**
 * Feature announcement for the Lottery.
 *
 * Closing never removes it: the dialog collapses into a bubble that reopens on
 * click, so the flag means "start collapsed" rather than "never show again".
 * Bump the version suffix to announce something else - a new key means every
 * browser gets the expanded dialog once more.
 */
const STORAGE_KEY = 'announcement-seen:lottery-2026-07'

/**
 * Only the landing page and the events list show the announcement. It mounts at
 * the router root, so an allowlist keeps it off every other route - including
 * the event workspace and the fullscreen presentation screens (lottery /
 * display / kiosk) that are projected in front of an audience.
 */
const ALLOWED_ROUTES = new Set(['/', '/events'])

/** Drifting motes around the illustration. Positions are percentages. */
const PARTICLES = [
  { x: 12, y: 22, size: 7, color: '#FFD35C', delay: 0, duration: 5.5 },
  { x: 86, y: 16, size: 5, color: '#7FE8FF', delay: 1.2, duration: 6.4 },
  { x: 22, y: 74, size: 6, color: '#B08CFF', delay: 2.1, duration: 5.9 },
  { x: 79, y: 68, size: 8, color: '#FF9FC7', delay: 0.7, duration: 6.8 },
  { x: 50, y: 8, size: 5, color: '#8FF0C4', delay: 2.8, duration: 5.2 },
  { x: 93, y: 44, size: 6, color: '#B08CFF', delay: 1.8, duration: 5.7 },
]

const CHIPS = [
  { icon: '🎁', label: 'בחירת פרס' },
  { icon: '👥', label: 'בחירת משתתפים' },
  { icon: '🏆', label: 'הכרזה חגיגית' },
]

/**
 * Where the feature actually lives. These strings are the labels the user sees
 * on screen, not route names: "הפעלות בזמן אמת" is the control-centre card
 * (ControlCenter.tsx) and "הגרלה" is the item inside it (live-events/types.ts).
 * The middle step opens a picker modal rather than a page - the /live-events
 * route is legacy and nothing links to it.
 */
const PATH_STEPS = [
  // The page background itself, so the first step reads as "the app".
  { label: 'לוח הבקרה', background: 'var(--gradient-background)', dark: true },
  // gradient-reward-medium on the control-centre card = --color-secondary.
  { label: 'הפעלות בזמן אמת', background: 'var(--color-secondary)', dark: false },
  // The lottery card's own green (LiveEventLibraryCard ACCENT_ICON.starter).
  // It carries dark ink, not white: white on this gradient is 1.7-2.6:1, dark
  // is 6-8.9:1.
  { label: 'הגרלה', background: 'linear-gradient(145deg,#6ADB8A,#2FB85A)', dark: true },
]

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Storage blocked (private mode, hardened browser settings). Start
    // collapsed: a dismissal we cannot persist would re-expand the dialog on
    // every single navigation. The bubble still offers it on demand.
    return true
  }
}

export function LotteryAnnouncementModal() {
  const { pathname } = useLocation()
  // 'pending' renders nothing for the first paint, so localStorage decides the
  // starting view instead of the dialog flashing open and snapping shut.
  const [view, setView] = useState<'pending' | 'open' | 'collapsed'>('pending')

  useEffect(() => {
    setView(wasDismissed() ? 'collapsed' : 'open')
  }, [])

  function collapse() {
    setView('collapsed')
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Nothing to do - see wasDismissed().
    }
  }

  if (!ALLOWED_ROUTES.has(pathname)) return null

  return (
    <>
      {view === 'collapsed' && (
        <motion.div
          // Below the dialog's z-[200]; the contact button sits bottom-left at
          // z-50, so the two never collide.
          className="fixed bottom-5 right-4 z-[190] sm:bottom-6 sm:right-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            type="button"
            onClick={() => setView('open')}
            aria-label="חדש ב-Gamify - פתיחת ההודעה על ההגרלה"
            className="flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_-4px_rgba(216,48,0,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-4px_rgba(216,48,0,0.65)] motion-reduce:hover:translate-y-0 sm:gap-2.5 sm:px-4 sm:py-3"
            style={{
              background:
                'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
            }}
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
      title="חדש ב-Gamify: הגרילו זוכים בלחיצת כפתור"
      dialogClassName="max-w-[420px]"
      contentClassName="!p-0"
      // A corner announcement should not black out the page behind it.
      overlayClassName="!bg-[rgba(40,25,20,0.18)] !backdrop-blur-0"
    >
      <div className="relative overflow-hidden">
        {/* Warm wash behind the whole panel - stops it reading as a white sheet. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[300px]"
          style={{
            background:
              'radial-gradient(ellipse 80% 66% at 50% 28%, rgba(255,196,90,0.20), rgba(255,196,90,0) 70%)',
          }}
        />

        {/* ---- banner + title ---- */}
        <div className="relative z-10 px-6 pb-0 pt-6 text-center">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 shadow-[0_6px_18px_-6px_rgba(216,48,0,0.65)]"
            style={{
              background:
                'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
            }}
          >
            {/*
              The mark is drawn for light surfaces - its red cup disappears
              against the brand gradient, so it sits on a white chip.
              Decorative: the adjacent text already says Gamify, so the default
              alt would have a screen reader announce the brand twice.
            */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(46,34,30,0.22)]">
              <BrandLogo alt="" className="h-[1.05rem] w-[1.05rem] object-contain" />
            </span>
            <span className="text-[15px] font-extrabold leading-none text-primary-foreground">
              חדש ב-Gamify
            </span>
          </span>

          <h3 className="mt-4 text-[25px] font-extrabold leading-[1.25] text-foreground sm:text-[27px]">
            הגרילו זוכים בלחיצת כפתור!
          </h3>
        </div>

        {/* ---- hero ---- */}
        {/* Pulled up over the heading: the top of the frame is empty except
            during the reveal, so only the rising ticket overlaps the text. */}
        <div className="relative isolate -mt-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[46%] h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(127,232,255,0.26), rgba(176,140,255,0.12) 45%, rgba(255,255,255,0) 70%)',
            }}
          />

          {PARTICLES.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                background: p.color,
                // No blur filter: a 0.5px blur is imperceptible but forces a
                // dedicated GPU layer per particle, and this loops forever.
              }}
              animate={{ y: [0, -14, 0], opacity: [0.25, 0.75, 0.25] }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}

          <motion.div
            className="relative z-10"
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/*
              Soft ground shadow. A radial-gradient paints it without a `blur`
              filter, so it costs no extra GPU layer under the looping image -
              a CSS filter here would re-rasterise on every frame, forever.
            */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[13%] left-1/2 h-8 w-[58%] -translate-x-1/2"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(120,90,200,0.22), rgba(120,90,200,0) 70%)',
              }}
            />
            <picture>
              {/*
                First matching source wins, so the reduced-motion still comes
                first. The loop runs forever with no pause control, which fails
                WCAG 2.2.2 for motion over five seconds - this is the opt-out.
              */}
              <source
                media="(prefers-reduced-motion: reduce)"
                srcSet="/images/lottery-announcement/lottery-poster.png"
                type="image/png"
              />
              <source srcSet="/images/lottery-announcement/lottery.webp" type="image/webp" />
              <img
                src="/images/lottery-announcement/lottery.gif"
                alt="תיבת הגרלה שקופה שאליה עפים פתקים מקופלים, מתנערת, ומתוכה עולה פתק זוכה שנפתח וחושף גביע"
                width={480}
                height={480}
                className="relative z-10 mx-auto block h-auto w-full max-w-[280px]"
                decoding="async"
              />
            </picture>
          </motion.div>
        </div>

        {/* ---- copy ---- */}
        <div className="relative z-10 -mt-2 px-6 pb-6 text-center">
          {/*
            The prose version of this ("בחרו משתתפים, הגדירו פרס...") said the
            same three things as the chips, so only the chips remain - they
            scan faster and cost less height, which keeps the dialog scroll-free.
          */}
          <ul className="flex flex-nowrap items-center justify-center gap-1.5">
            {CHIPS.map((chip) => (
              <li
                key={chip.label}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/70 bg-white/55 px-2.5 py-1.5 text-[12px] font-semibold text-foreground shadow-[0_2px_10px_-3px_rgba(46,34,30,0.18)]"
              >
                <span aria-hidden="true" className="text-[13px] leading-none">{chip.icon}</span>
                {chip.label}
              </li>
            ))}
          </ul>

          {/*
            Awareness, not navigation - a tinted tip panel rather than pills, so
            it reads as guidance and not as another row of feature chips.
          */}
          <div className="mt-6 rounded-2xl border border-border bg-[var(--color-background)] px-4 py-4 shadow-[0_2px_12px_-4px_rgba(46,34,30,0.16)]">
            <p className="flex items-center justify-center gap-1.5 text-[14px] font-bold text-primary-text">
              <MapPin size={15} strokeWidth={2.5} aria-hidden="true" />
              איפה מוצאים את זה?
            </p>

            <p className="mt-1.5 text-[13px] leading-[1.6] text-muted">
              הפיצ'ר החדש כבר זמין במערכת.
            </p>

            <ol className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
              {PATH_STEPS.map((step, i) => (
                <li key={step.label} className="flex items-center gap-2">
                  {i > 0 && (
                    // Points left: the app's own "next" affordance in RTL
                    // (ControlCenter's card CTA reads "בחרו הפעלה ←").
                    <span aria-hidden="true" className="text-[13px] text-muted">←</span>
                  )}
                  <span
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[13px] font-semibold shadow-[0_1px_3px_rgba(46,34,30,0.14)]',
                      // The two solid chips use the darkened -text variants of
                      // their card colours: white on the raw #45CF6B green is
                      // only 2:1, while these clear 4.9:1.
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
