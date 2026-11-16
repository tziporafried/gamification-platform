import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { BrandLogo } from '@/components/icons/BrandLogo'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

/**
 * Feature announcement for secret missions ("משימה סודית", the
 * `secret_missions` flag).
 *
 * Same shell as FlashAnnouncementModal: closing collapses the dialog into a
 * bubble that reopens on click, so the flag means "start collapsed" rather than
 * "never show again". Bump the version suffix to announce again.
 */
const STORAGE_KEY = 'announcement-seen:secret-2026-11'


/** Drifting motes around the illustration. Positions are percentages. */
const PARTICLES = [
  { x: 7, y: 16, size: 7, color: '#C9A6F2', delay: 0, duration: 5.6 },
  { x: 91, y: 10, size: 5, color: '#FF9FC7', delay: 1.1, duration: 6.3 },
  { x: 4, y: 74, size: 6, color: '#FFD35C', delay: 2.0, duration: 5.8 },
  { x: 94, y: 70, size: 8, color: '#B08CFF', delay: 0.6, duration: 6.7 },
  { x: 52, y: 1, size: 5, color: '#8FF0C4', delay: 2.7, duration: 5.3 },
]

const CHIPS = [
  { icon: '👤', label: 'של משתתף אחד' },
  { icon: '🤦', label: 'אף אחד לא יודע' },
  { icon: '🎉', label: 'נחשפת בסריקה' },
]

/**
 * Where the feature lives: the game wizard's tasks step, then the kind tab
 * above the task field (AddTaskPanel.tsx).
 */
const PATH_STEPS = [
  { label: 'עריכת הפעילות', background: 'var(--gradient-background)', dark: true },
  { label: 'צבירת נקודות', background: 'var(--color-secondary)', dark: false },
  // The scan screen's secret badge plum, tinted - dark ink holds contrast on it.
  { label: '🤫 משימה סודית', background: 'color-mix(in srgb, #7B4FB8 14%, white)', dark: true },
]

/** The sample mission the illustration plays out. */
const OWNER = 'דבורי'
const MISSION = 'לגרום לכולם להחליף מקומות ישיבה'
const POINTS = 40

// One play, then a rest on its final frame, then again - the other popups'
// pattern, which keeps the GPU idle between plays.
const PLAY_MS = 6200
const REST_MS = 4000

// Beats inside one play, in seconds.
const T_CARD = 0.15 // the hidden card lands
const T_SHUSH = 0.9 // the 🤫 shakes its head
const T_SCAN = 2.2 // the scanner sweeps the card
const T_REVEAL = 3.0 // the card flips to the reveal


const PLUM = '#7B4FB8'

export function markSecretAnnouncementSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Storage blocked - nothing to save it in. See secretAnnouncementSeen().
  }
}

export function secretAnnouncementSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Storage blocked - start collapsed so a dismissal we cannot save does not
    // re-expand the dialog on every navigation. The bubble still offers it.
    return true
  }
}

/**
 * The dialog alone. Whether it is open, what closing it does, the "seen" flag
 * and the bubble all belong to AnnouncementSequence, which runs every
 * announcement through one queue and one rotating bubble.
 */
export function SecretAnnouncementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Bumped each play so the scene remounts and replays from its first beat.
  const [cycle, setCycle] = useState(0)
  // Reduced motion (or a hidden tab): render the scene's final frame, no play.
  const [still, setStill] = useState(false)

  useEffect(() => {
    if (!open) return
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
  }, [open])

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        chromeless
        placement="corner"
        title="חדש ב-Gamify: משימה סודית"
        dialogClassName="max-w-[420px]"
        contentClassName="!p-0"
        overlayClassName="!bg-[rgba(40,25,20,0.18)] !backdrop-blur-0"
      >
        <div className="relative overflow-hidden">
          {/* Plum-warm wash behind the panel - stops it reading as a white sheet. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[300px]"
            style={{
              background:
                'radial-gradient(ellipse 80% 66% at 50% 28%, rgba(150,100,210,0.20), rgba(150,100,210,0) 70%)',
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
              🤫 משימה סודית!
            </h3>
            <p className="mt-1.5 text-[14px] leading-[1.55] text-muted">
              משימה שרק משתתף אחד יודע עליה - וכולם מגלים מה היא רק אחרי שנסרקה
            </p>
          </div>

          {/* ---- illustration ---- */}
          <div
            className="relative isolate mt-4 px-6"
            role="img"
            aria-label="כרטיס במסך הסריקה שכתוב עליו רק 'המשימה הסודית של דבורי', נסרק, ומתהפך לחשוף את המשימה: לגרום לכולם להחליף מקומות ישיבה"
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

            <SecretScene key={cycle} still={still} />
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
                בהוספת פעילות בוחרים &quot;משימה סודית&quot;, ואת המשתתף שהיא שלו.
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
 * The mission as the scan screen shows it, then as the scan reveals it.
 *
 * Choreography after the project's animation references: the hidden card lands
 * with animate.style's `bounceIn` overshoot and its 🤫 does a `headShake`; a
 * scanner line sweeps it; then it turns over like `flipInY` into the reveal,
 * whose words rise Jitter-style (offset + spring, staggered) and whose points
 * pop like `bounceInUp`. Transforms and opacity only - no blur or filter (see
 * the lottery popup's history).
 *
 * `still` renders the final frame - the reveal - at once, for reduced motion.
 */
function SecretScene({ still }: { still: boolean }) {
  const [revealed, setRevealed] = useState(still)

  useEffect(() => {
    if (still) {
      setRevealed(true)
      return
    }
    const timer = window.setTimeout(() => setRevealed(true), T_REVEAL * 1000)
    return () => window.clearTimeout(timer)
  }, [still])

  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[330px]" style={{ perspective: 900 }}>
      {/* Fixed height, so the flip does not jolt the copy under it. */}
      <div className="relative h-[168px]">
        <AnimatePresence initial={false} mode="wait">
          {!revealed ? (
            <motion.div
              key="hidden"
              className="absolute inset-x-0 top-3 rounded-2xl bg-white px-4 pb-5 pt-7 text-center shadow-[0_10px_24px_-8px_rgba(80,40,120,0.35)]"
              style={{ border: '1.5px solid #E4D3F7' }}
              initial={still ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ rotateY: 90, opacity: 0.6, transition: { duration: 0.28, ease: 'easeIn' } }}
              transition={{ delay: T_CARD, type: 'spring', stiffness: 320, damping: 13 }}
            >
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-black text-white shadow-[0_4px_10px_-2px_rgba(123,79,184,0.5)]"
                style={{ background: 'linear-gradient(90deg,#7B4FB8,#B35FA8)' }}
              >
                משימה סודית
              </span>
              <motion.span
                className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[24px] shadow-[0_6px_14px_-4px_rgba(80,40,120,0.4)]"
                style={{ border: `2.5px solid ${PLUM}` }}
                initial={false}
                animate={still ? {} : { rotate: [0, -14, 12, -8, 5, 0] }}
                transition={{ delay: T_SHUSH, duration: 0.9, ease: 'easeInOut' }}
              >
                🤫
              </motion.span>

              <div className="text-[19px] font-black text-foreground">המשימה הסודית של {OWNER}</div>
              <div className="mt-2 text-[13px] font-semibold text-muted">??? ??? ???</div>

              {/* The scanner reading it - a bright line down the card. */}
              {!still && (
                <motion.span
                  className="pointer-events-none absolute inset-x-3 top-0 h-[3px] rounded-full"
                  style={{ background: 'linear-gradient(90deg,transparent,#62C98A,transparent)', boxShadow: '0 0 12px #62C98A' }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [8, 60, 112, 130] }}
                  transition={{ delay: T_SCAN, duration: 0.75, ease: 'easeInOut' }}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="revealed"
              className="absolute inset-x-0 top-3 rounded-2xl bg-white px-4 pb-5 pt-6 text-center shadow-[0_12px_28px_-8px_rgba(80,40,120,0.4)]"
              style={{ border: `2px solid ${PLUM}55` }}
              initial={still ? false : { rotateY: -90, opacity: 0.6 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            >
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-black text-white shadow-[0_4px_10px_-2px_rgba(62,158,107,0.5)]"
                style={{ background: 'linear-gradient(135deg,#62C98A,#3E9E6B)' }}
              >
                משימה סודית הושלמה!
              </span>

              <motion.div
                className="text-[13px] font-extrabold"
                style={{ color: PLUM }}
                initial={still ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
              >
                המשימה הסודית של {OWNER} הייתה:
              </motion.div>

              <div
                className="mx-auto mt-2 flex flex-wrap justify-center gap-x-1.5 rounded-xl px-3 py-2 text-[18px] font-black leading-snug text-foreground"
                style={{ background: 'rgba(176,127,224,0.12)', border: '1.5px dashed rgba(123,79,184,0.45)' }}
              >
                {MISSION.split(' ').map((word, i) => (
                  <motion.span
                    key={i}
                    initial={still ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 + i * 0.09, type: 'spring', stiffness: 360, damping: 18 }}
                  >
                    {word}
                  </motion.span>
                ))}
              </div>

              <motion.span
                dir="ltr"
                className="absolute -bottom-3 -left-3 whitespace-nowrap rounded-full bg-[#FFF4E0] px-2.5 py-1 text-[14px] font-black text-[#C8941A] shadow-[0_4px_12px_-2px_rgba(242,179,60,0.55)]"
                style={{ border: '2px solid rgba(242,179,60,0.9)' }}
                initial={still ? false : { opacity: 0, y: 16, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1.0, type: 'spring', stiffness: 420, damping: 14 }}
              >
                ⭐ +{POINTS}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
