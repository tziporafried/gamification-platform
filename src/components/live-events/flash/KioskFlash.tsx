import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Flag, TimerReset, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { screenControlClass } from '@/components/ui/ScreenControls'
import { PlayerPicker, type BonusParticipantOption } from '@/components/kiosk/BonusAwardModal'
import { FLASH_EXTEND_SECONDS, formatClock } from '@/lib/flashChallenge/flashChallenge'
import { FlashIntroBurst } from './FlashIntroBurst'
import { FlashSetupStage } from './FlashSetupStage'
import { FlashSummaryStage, FlashTimesUp } from './FlashSummaryStage'
import type { FlashChallenge } from './flashChallengeStore'
import type { FlashChallengeController } from './useFlashChallenge'
import type { FlashScanFeedback } from './useFlashChallengeScanner'

/**
 * The flash challenge, laid over the scan screen.
 *
 * The scanner stays where it always is - in the middle - because that is
 * where completing the challenge happens. Around it:
 *
 *   KioskFlashHeadline    "השלמתם את האתגר? סרקו!", in place of "סרקו וזכו"
 *   KioskFlashCard        title, countdown and points, in the recommended
 *                         mission's slot on the orange panel
 *   KioskFlashCompleters  who made it, under the card, in place of the feed
 *   KioskFlashFeedback    each scan's answer, over the scanner frame
 *   KioskFlashLayer       the popups and takeovers: the form, the intro, the
 *                         "time's up" beat, the summary, the operator's corner
 */

/** The countdown turns urgent for the last stretch. */
const URGENT_MS = 10_000

const MEDALS = ['🥇', '🥈', '🥉']

// ─── Center column ────────────────────────────────────────────────────────────

/** In place of "סרקו וזכו בנקודות!" - the one thing to do right now. */
export function KioskFlashHeadline() {
  return (
    <div style={{ textAlign: 'center', maxWidth: 620, flexShrink: 0 }}>
      <div className="kiosk-scanWinHeadline" style={{ fontSize: 40, fontWeight: 900 }}>
        <span className="kiosk-scanWinWord" style={{ color: '#FF8A3D', animationDelay: '0s' }}>השלמתם</span>
        <span className="kiosk-scanWinWord" style={{ color: '#F2A03C', animationDelay: '0.35s' }}>את האתגר?</span>
        <span className="kiosk-scanWinWord" style={{ color: '#E8A93C', animationDelay: '0.7s' }}>סרקו!</span>
        <span className="kiosk-scanWinWord" style={{ animationDelay: '1.05s' }}>⚡</span>
      </div>
      <div className="kiosk-scanWinSubtitle" style={{ fontSize: 18, fontWeight: 700, color: '#7D706A' }}>
        הראשונים לסיים מקבלים הכי הרבה נקודות
      </div>
    </div>
  )
}

// ─── Right panel - the challenge card ─────────────────────────────────────────

/**
 * The challenge, in the slot the recommended mission normally fills, and in
 * that card's language on purpose: the same white card, the badge riding its
 * top edge, the floating icon on its corner and the points pill hanging off its
 * bottom - so it reads as "the mission right now", which is what it is. The
 * mission card's own timer style is reused for the countdown, and goes red in
 * the last ten seconds the way an expiring mission does.
 */
export function KioskFlashCard({ challenge, remainingMs }: { challenge: FlashChallenge; remainingMs: number }) {
  const reduceMotion = useReducedMotion()
  const urgent = remainingMs <= URGENT_MS
  const totalMs = challenge.durationSec * 1000
  const fraction = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0
  const clock = formatClock(remainingMs / 1000)
  const [minutes, seconds] = clock.split(':')
  const blink = !reduceMotion && Math.ceil(remainingMs / 1000) % 2 === 1

  return (
    <div
      dir="rtl"
      style={{
        position: 'relative', zIndex: 1, borderRadius: 22, boxSizing: 'border-box', width: '100%',
        padding: '46px 20px 26px',
        background: '#FFFFFF', boxShadow: '0 10px 24px rgba(120,50,10,0.18)',
        overflow: 'visible', color: '#2E221E',
        border: `2px solid ${urgent ? 'rgba(216,32,16,0.6)' : 'rgba(255,120,50,0.55)'}`,
      }}
    >
      <div className="kiosk-missionTypeBadgeAnchor" aria-hidden>
        <div
          className={cn(
            'kiosk-missionTypeBadge kiosk-missionTypeBadge--active',
            !reduceMotion && 'kiosk-missionTypeBadge--enter',
            urgent && 'kiosk-missionTypeBadge--urgent',
          )}
        >
          ⚡ אתגר בזק
        </div>
      </div>

      <div style={{ position: 'absolute', top: -30, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,147,102,0.1)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 22, pointerEvents: 'none' }}>
        <div className="kiosk-shimmerSweep" style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)' }} />
      </div>

      {/* Floating bolt on the corner, where the mission card has its 🎯 */}
      <div className="kiosk-floatY-2" style={{ position: 'absolute', top: -24, right: -22, zIndex: 30, width: 74, height: 74 }}>
        <div
          className="kiosk-pulseGlow"
          style={{
            position: 'absolute', inset: -6, borderRadius: '50%', pointerEvents: 'none',
            background: urgent
              ? 'radial-gradient(circle, rgba(255,80,40,0.45) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(255,147,102,0.4) 0%, transparent 70%)',
          }}
        />
        <div
          className="kiosk-fireFlicker"
          style={{
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', height: '100%', borderRadius: '50%', fontSize: 48, lineHeight: 1,
            background: 'linear-gradient(145deg,#FFFFFF,#FFF4EC)',
            border: `3px solid ${urgent ? 'rgba(220,50,20,0.85)' : 'rgba(255,100,40,0.75)'}`,
            boxShadow: '0 10px 26px rgba(120,50,10,0.28), 0 0 0 5px rgba(255,255,255,0.9), 0 0 20px rgba(255,147,102,0.3)',
          }}
          aria-hidden
        >
          ⚡
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div className={reduceMotion ? undefined : 'kiosk-missionSwapTitleIn'} style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, maxWidth: '100%' }}>
          {challenge.title}
        </div>

        <div style={{ marginTop: 12, width: '100%' }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, color: urgent ? '#B82018' : '#B5623C', marginBottom: 4 }}>
            {urgent ? '⚡ מהרו - הזמן אוזל!' : 'זמן נותר לאתגר'}
          </div>
          <motion.div
            key={urgent ? clock : 'calm'}
            initial={urgent && !reduceMotion ? { scale: 1.18 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14 }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3, direction: 'ltr',
              fontSize: 'clamp(40px, 4.6vw, 54px)', fontWeight: 900, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em',
              color: urgent ? '#D82010' : '#D45A1A',
            }}
            aria-label={`נותרו ${Math.ceil(remainingMs / 1000)} שניות`}
          >
            <span>{minutes}</span>
            <span style={{ marginBottom: 4, opacity: blink ? 0.15 : 1 }}>:</span>
            <span>{seconds}</span>
          </motion.div>

          {/* How much of the clock is left, as a bar the room can read at a glance. */}
          <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: 'rgba(239,138,78,0.15)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', width: `${fraction * 100}%`, borderRadius: 999,
                background: urgent ? 'linear-gradient(90deg,#FF5A3C,#D82010)' : 'linear-gradient(90deg,#FFB84D,#FF8A3D)',
                transition: 'width 0.25s linear',
              }}
            />
          </div>
        </div>
      </div>

      {/* Points pill hanging off the bottom corner, like the mission card's */}
      <div style={{ position: 'absolute', bottom: -16, left: -18, zIndex: 40, pointerEvents: 'none' }}>
        <div
          className={reduceMotion ? undefined : 'kiosk-pointsFlyIn'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(145deg,#FFFFFF,#FFF4E0)',
            border: '2.5px solid rgba(242,179,60,0.9)', borderRadius: 999, padding: '7px 14px 7px 10px',
            boxShadow: '0 10px 28px rgba(242,179,60,0.48), 0 0 0 4px rgba(255,255,255,0.95), 0 0 24px rgba(242,179,60,0.32)',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="kiosk-fireFlicker" style={{ fontSize: 14, lineHeight: 1 }}>⭐</span>
          <span
            className="kiosk-numberGlow"
            style={{ direction: 'ltr', fontSize: 28, fontWeight: 900, color: '#C8941A', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
          >
            +{challenge.points}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Each scan's answer, over the scanner frame (its `overlay` slot). */
export function KioskFlashFeedback({ feedback, feedbackId }: { feedback: FlashScanFeedback | null; feedbackId: number }) {
  const reduceMotion = useReducedMotion()
  return (
    <AnimatePresence>
      {feedback && (
        <motion.div
          key={feedbackId}
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ background: 'rgba(255,250,246,0.55)', backdropFilter: 'blur(3px)' }}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          role={feedback.kind === 'completed' ? 'status' : 'alert'}
        >
          <FlashFeedbackCard feedback={feedback} reduceMotion={!!reduceMotion} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function FlashFeedbackCard({ feedback, reduceMotion }: { feedback: FlashScanFeedback; reduceMotion: boolean }) {
  const base =
    'flex w-[min(92%,24rem)] flex-col items-center gap-2 rounded-[1.75rem] px-6 py-6 text-center shadow-[0_24px_60px_rgba(46,34,30,0.22)]'

  if (feedback.kind === 'completed') {
    const medal = MEDALS[feedback.rank - 1]
    return (
      <div className={cn(base, 'border-2 border-warning/60 bg-[linear-gradient(155deg,#FFFDF7,#FFE7D3)]')}>
        <motion.div
          className="text-6xl leading-none"
          initial={reduceMotion ? false : { scale: 0.3, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 12 }}
          aria-hidden="true"
        >
          {medal ?? '⚡'}
        </motion.div>
        <p className="text-3xl font-black text-foreground">{feedback.participantName}</p>
        <p className="rounded-full bg-gradient-to-l from-[#FF9366] to-[#F2B33C] px-5 py-1.5 text-lg font-black text-white shadow-[0_8px_22px_rgba(255,147,102,0.4)]">
          +{feedback.points} נקודות
        </p>
        <p className="text-sm font-bold text-muted">מקום {feedback.rank}</p>
      </div>
    )
  }

  if (feedback.kind === 'duplicate') {
    return (
      <div className={cn(base, 'bg-white/95 ring-1 ring-border')}>
        <div className="text-5xl leading-none" aria-hidden="true">✅</div>
        <p className="text-2xl font-black text-foreground">{feedback.participantName}</p>
        <p className="text-lg font-black text-secondary-text">כבר השלים/ה את האתגר</p>
      </div>
    )
  }

  const message =
    feedback.kind === 'task_card_only'
      ? feedback.message
      : feedback.kind === 'unknown_card'
        ? 'הכרטיס לא שייך למשחק הזה'
        : feedback.kind === 'closed'
          ? 'האתגר נסגר'
          : feedback.message

  return (
    <div className={cn(base, 'bg-[rgba(255,246,244,0.97)] ring-1 ring-danger/30')}>
      <div className="text-5xl leading-none" aria-hidden="true">
        {feedback.kind === 'closed' ? '⏱️' : '🚫'}
      </div>
      <p className="text-xl font-black leading-snug text-danger-text">{message}</p>
    </div>
  )
}

// ─── Right panel ──────────────────────────────────────────────────────────────

/** Who made it, in order - in place of the missions panel's content. */
export function KioskFlashCompleters({ challenge }: { challenge: FlashChallenge }) {
  const reduceMotion = useReducedMotion()
  const count = challenge.completions.length

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-3" dir="rtl">
      <div className="flex shrink-0 items-center justify-between gap-3 px-1">
        <div className="text-[18px] font-black text-white" style={{ textShadow: '0 2px 8px rgba(120,50,10,0.25)' }}>
          🏁 מי השלים?
        </div>
        <motion.div
          key={count}
          className="rounded-full bg-white px-3 py-1 text-[15px] font-black tabular-nums text-[#E07A3E] shadow-sm"
          initial={reduceMotion ? false : { scale: 1.25 }}
          animate={{ scale: 1 }}
          aria-live="polite"
        >
          {count.toLocaleString('he-IL')} השלימו
        </motion.div>
      </div>

      {count === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl bg-white/20 text-center text-lg font-black text-white">
          מי יהיה הראשון? 🏃
        </div>
      ) : (
        <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-1">
          <AnimatePresence initial={false}>
            {challenge.completions.map((c, i) => (
              <motion.li
                key={c.participantId}
                layout
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 font-black shadow-[0_4px_12px_rgba(120,50,10,0.12)]',
                  i < 3 ? 'py-2.5 text-lg ring-2 ring-[#FFD68A]' : 'py-1.5 text-base',
                )}
              >
                <span className="w-8 shrink-0 text-center tabular-nums text-[#B5623C]">
                  {i < 3 ? MEDALS[i] : `${i + 1}.`}
                </span>
                <span className="min-w-0 flex-1 truncate text-start text-[#2E221E]">{c.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-[#E07A3E]">+{c.points}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  )
}

// ─── Popups and takeovers ─────────────────────────────────────────────────────

function Backdrop({ children, onClose, label }: { children: ReactNode; onClose?: () => void; label: string }) {
  return (
    <motion.div
      role="dialog"
      aria-label={label}
      className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(46,34,30,0.55)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose()
      }}
      dir="rtl"
    >
      {children}
    </motion.div>
  )
}

/** A takeover that hides the scan screen behind a warm wash. */
function Takeover({ children, label }: { children: ReactNode; label: string }) {
  return (
    <motion.div
      role="dialog"
      aria-label={label}
      className="absolute inset-0 z-[55] flex items-center justify-center"
      style={{ background: 'rgba(255,248,243,0.86)', backdropFilter: 'blur(10px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      dir="rtl"
    >
      {children}
    </motion.div>
  )
}

export function KioskFlashLayer({ flash, scanMode }: { flash: FlashChallengeController; scanMode: string | null }) {
  const { phase, challenge } = flash

  return (
    <>
      <AnimatePresence>
        {phase === 'setup' && (
          <Backdrop key="setup" label="אתגר בזק" onClose={flash.closeSetup}>
            <div className="relative w-full max-w-2xl">
              <button
                type="button"
                onClick={flash.closeSetup}
                aria-label="סגירה"
                className="absolute -top-3 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#2E221E] text-white"
              >
                <X size={16} strokeWidth={2.5} aria-hidden="true" />
              </button>
              <FlashSetupStage onLaunch={flash.launch} scanMode={scanMode} />
            </div>
          </Backdrop>
        )}

        {phase === 'intro' && flash.introTitle && (
          <Takeover key="intro" label="אתגר בזק">
            <FlashIntroBurst title={flash.introTitle} onDone={flash.introDone} />
          </Takeover>
        )}

        {phase === 'timesup' && (
          <Takeover key="timesup" label="הזמן נגמר">
            <FlashTimesUp onDone={flash.timesUpDone} />
          </Takeover>
        )}

        {phase === 'summary' && challenge && (
          <Backdrop key="summary" label="סיכום אתגר בזק" onClose={flash.dismiss}>
            <FlashSummaryStage challenge={challenge} celebrate={flash.celebrate} onClose={flash.dismiss} />
          </Backdrop>
        )}
      </AnimatePresence>

      {/* A late card after the close is still answered, above the summary. */}
      {(phase === 'timesup' || phase === 'summary') && (
        <AnimatePresence>
          {flash.feedback && (
            <motion.div
              key={flash.feedbackId}
              className="pointer-events-none absolute inset-x-0 bottom-8 z-[60] flex justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              role="alert"
            >
              <FlashFeedbackCard feedback={flash.feedback} reduceMotion={false} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* The operator's corner - top-left, clear of the screen controls. */}
      {phase === 'live' && (
        <div dir="rtl" className="fixed left-2.5 top-2.5 z-[300] flex items-center gap-2">
          <button
            type="button"
            onClick={flash.extend}
            className={cn(screenControlClass, 'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold')}
          >
            <TimerReset size={14} strokeWidth={2.25} className="text-neutral-400" aria-hidden="true" />
            +{FLASH_EXTEND_SECONDS} שניות
          </button>
          <button
            type="button"
            onClick={flash.finish}
            className={cn(screenControlClass, 'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold')}
          >
            <Flag size={14} strokeWidth={2.25} className="text-neutral-400" aria-hidden="true" />
            סיום האתגר עכשיו
          </button>
        </div>
      )}
    </>
  )
}

// ─── Manual fallback ──────────────────────────────────────────────────────────

/**
 * The challenge's version of the scan screen's "הזנה ידנית": for a card that
 * will not read, or a participant who left theirs at the table. Only a name -
 * the challenge never needs a task - picked with the same field the bonus popup
 * uses, in the same frame, so the operator does not meet a third design.
 */
export function KioskFlashManualModal({
  isOpen,
  onClose,
  participants,
  loading,
  challenge,
  onSubmit,
}: {
  isOpen: boolean
  onClose: () => void
  participants: BonusParticipantOption[]
  loading: boolean
  challenge: FlashChallenge | null
  onSubmit: (participant: { id: string; name: string }) => void
}) {
  const [selected, setSelected] = useState<BonusParticipantOption | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // The scan screen re-renders with the clock, handing in a new onClose each
  // time; keyed on it, the reset below would wipe the pick four times a second.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // A fresh pick every time it opens.
  useEffect(() => {
    if (!isOpen) return
    setSelected(null)
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  if (!isOpen || !challenge) return null

  const done = selected ? challenge.completions.some((c) => c.participantId === selected.id) : false
  const ready = !!selected && !done

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="השלמת אתגר ידנית"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(12px, 2vw, 28px)',
        background: 'rgba(74,42,26,0.42)', backdropFilter: 'blur(10px)', direction: 'rtl',
      }}
    >
      <div style={{
        position: 'relative', width: 'min(480px, 100%)', maxHeight: '100%',
        borderRadius: 32, padding: 4,
        background: 'linear-gradient(135deg,#FF9366,#F2B33C 40%,#FFCB9A 70%,#8FCFA0)',
        boxShadow: '0 28px 70px rgba(171,53,0,0.34)',
        animation: 'kiosk-cardBounceIn 0.45s cubic-bezier(0.2,0.9,0.25,1.15) both',
        display: 'flex',
      }}>
        <div style={{
          flex: 1, minHeight: 0, borderRadius: 28,
          background: 'linear-gradient(160deg,#FFFFFF,#FFF6F0)',
          padding: 'clamp(18px, 2vw, 26px)',
          display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <div className="kiosk-bob" style={{
              width: 54, height: 54, borderRadius: 18, flexShrink: 0,
              background: 'linear-gradient(135deg,#FF9366,#F2B33C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, boxShadow: '0 10px 24px rgba(255,147,102,0.4)',
            }}>⚡</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'clamp(20px, 2.2vw, 25px)', fontWeight: 900, color: '#2E221E' }}>
                מי השלים את האתגר?
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#A08172', marginTop: 2 }}>
                {challenge.title}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: '#FFF1E7', color: '#B4552A',
                border: '1.5px solid #FFE1CC', cursor: 'pointer', fontSize: 19,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>

          <PlayerPicker
            inputRef={inputRef}
            participants={participants}
            loading={loading}
            selected={selected}
            onSelect={setSelected}
          />

          {done && (
            <div role="alert" style={{ fontSize: 13.5, fontWeight: 900, color: '#2F6F69' }}>
              ✅ {selected!.name} כבר השלים/ה את האתגר
            </div>
          )}

          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              if (!selected || !ready) return
              onSubmit({ id: selected.id, name: selected.name })
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 24px', borderRadius: 999, border: 'none',
              background: ready ? 'linear-gradient(135deg,#FF9366,#F2B33C)' : 'linear-gradient(135deg,#FBE0CE,#F4D2BB)',
              color: ready ? '#fff' : '#C08560',
              fontSize: 17, fontWeight: 900, cursor: ready ? 'pointer' : 'default',
              boxShadow: ready ? '0 8px 22px rgba(255,147,102,0.42)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            <span>אישור השלמה</span>
            <span aria-hidden="true">⚡</span>
          </button>
        </div>
      </div>
    </div>
  )
}
