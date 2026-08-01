import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ScannerFrame } from '@/components/kiosk/ScannerFrame'
import type { LotteryScannerState } from './useLotteryScanner'

interface ScanLotteryCollectingStageProps {
  scanner: LotteryScannerState
  /**
   * How many are in the hat. One ticket per participant, so this is both the
   * headcount and the number of tickets - there is no second number to show.
   */
  participants: number
  /**
   * False when this game may not scan from here (a plan without scanning, or a
   * game that has not started). The stage then explains itself instead of
   * pretending to listen for cards.
   */
  scanningAllowed: boolean
  /** Why scanning is unavailable, when it is. */
  blockedReason?: string
}

/**
 * The stage while a scan lottery is collecting.
 *
 * The idle stage runs generic anticipation copy, which is the wrong screen for
 * this moment: the room's job right now is to scan. So the stage becomes the
 * game's own scan screen - the same frame, beam, corner brackets and waiting
 * overlay the kiosk shows (`@/components/kiosk/ScannerFrame`) - with the wedge
 * scanner's hidden input living inside it. A person walking up should not have
 * to work out that this is the same act they already know; only the reward
 * line changes, from points to a lottery ticket.
 *
 * Under the frame sits the one number that makes the room keep scanning: how
 * many are already in. A ticket each means the headcount and the ticket count
 * are the same number, so there is nothing else to show.
 */
export function ScanLotteryCollectingStage({
  scanner,
  participants,
  scanningAllowed,
  blockedReason,
}: ScanLotteryCollectingStageProps) {
  const reduceMotion = useReducedMotion()
  const { bind, pending, remainingSeconds, waitProgress, feedback, submitting } = scanner

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-1 flex-col items-center overflow-hidden px-6 text-center"
      style={{ gap: 'clamp(8px, 1.6vh, 20px)', paddingBlock: 'clamp(8px, 2vh, 24px)' }}
    >
      {/* The wedge scanner types here. Kept inside the stage so it mounts and
          unmounts with the collecting state, and refocuses while it is up. */}
      <input ref={bind} className="sr-only" aria-hidden="true" tabIndex={-1} />

      {/* Headline - the kiosk's "סרקו וזכו" line, with the lottery's payoff */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <span
          className="inline-flex items-center gap-2 rounded-full border border-[#FF9366]/35 bg-white/75 px-4 py-1.5 shadow-sm backdrop-blur-sm"
          style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', fontWeight: 900, color: '#B4552A' }}
        >
          <span
            className="kiosk-blink h-2.5 w-2.5 rounded-full"
            style={{ background: '#EF8A4E' }}
            aria-hidden="true"
          />
          ההגרלה פתוחה
        </span>

        <div
          className="kiosk-scanWinHeadline"
          style={{ fontSize: 'clamp(26px, 3.2vw, 42px)', fontWeight: 900 }}
        >
          <span className="kiosk-scanWinWord" style={{ color: '#FF8A3D', animationDelay: '0s' }}>סרקו</span>
          <span className="kiosk-scanWinWord" style={{ color: '#F2A03C', animationDelay: '0.35s' }}>וזכו</span>
          <span className="kiosk-scanWinWord" style={{ color: '#E8A93C', animationDelay: '0.7s' }}>בכרטיס להגרלה!</span>
          <span className="kiosk-scanWinWord" style={{ animationDelay: '1.05s' }}>🎟️</span>
        </div>

      </div>

      <div className="kiosk-scannerSlot">
        <ScannerFrame
          processing={submitting}
          locked={!scanningAllowed}
          lockedTitle="הסריקה אינה זמינה"
          lockedHint={blockedReason ?? 'לא ניתן לסרוק מהמסך הזה.'}
          awaiting={!!pending}
          awaitingSeconds={remainingSeconds}
          awaitingRewardLine="סרקו עכשיו את כרטיס המשימה כדי לזכות בכרטיס להגרלה"
          waitProgress={waitProgress}
          overlay={
            <AnimatePresence>
              {feedback && (
                <motion.div
                  key={
                    feedback.kind === 'scored'
                      ? `scored-${feedback.participantName}-${feedback.actionName}`
                      : feedback.kind === 'duplicate'
                        ? `duplicate-${feedback.participantName}`
                        : feedback.kind === 'wrong_answer'
                          ? `wrong-${feedback.participantName}-${feedback.actionName}`
                          : `error-${feedback.message}`
                  }
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-[8%] text-center"
                  style={{
                    background:
                      feedback.kind === 'error'
                        ? 'radial-gradient(circle at 50% 42%,rgba(255,250,248,0.96),rgba(255,232,228,0.93))'
                        : 'radial-gradient(circle at 50% 42%,rgba(255,250,246,0.96),rgba(255,236,222,0.93))',
                    backdropFilter: 'blur(4px)',
                  }}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  role={feedback.kind === 'error' ? 'alert' : undefined}
                >
                  {feedback.kind === 'scored' ? (
                    <>
                      <motion.div
                        style={{ fontSize: 'clamp(40px, 9cqw, 64px)', lineHeight: 1 }}
                        initial={reduceMotion ? false : { scale: 0.4, rotate: -18 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 14 }}
                        aria-hidden="true"
                      >
                        🎟️
                      </motion.div>
                      <div
                        style={{ fontSize: 'clamp(20px, 5cqw, 30px)', fontWeight: 900, color: '#2E221E' }}
                      >
                        {feedback.participantName}
                      </div>
                      <div
                        className="rounded-full px-5 py-2 text-white"
                        style={{
                          background: 'linear-gradient(135deg,#FF9366,#F2B33C)',
                          boxShadow: '0 8px 22px rgba(255,147,102,0.4)',
                          fontSize: 'clamp(13px, 3cqw, 17px)',
                          fontWeight: 900,
                        }}
                      >
                        כרטיס נוסף להגרלה
                      </div>
                      <div
                        style={{ fontSize: 'clamp(12px, 2.7cqw, 15px)', fontWeight: 700, color: '#7D706A' }}
                      >
                        {feedback.actionName}
                      </div>
                    </>
                  ) : feedback.kind === 'wrong_answer' ? (
                    // The scan saved and spent the attempt; it just did not buy
                    // a ticket. Said plainly, and without naming the right
                    // answer to a room full of people who have not answered yet.
                    <>
                      <div style={{ fontSize: 'clamp(40px, 9cqw, 64px)', lineHeight: 1 }} aria-hidden="true">
                        ❓
                      </div>
                      <div
                        style={{ fontSize: 'clamp(20px, 5cqw, 30px)', fontWeight: 900, color: '#2E221E' }}
                      >
                        {feedback.participantName}
                      </div>
                      <div
                        className="rounded-full px-5 py-2"
                        style={{
                          background: 'rgba(125,112,106,0.14)',
                          color: '#6B605B',
                          fontSize: 'clamp(13px, 3cqw, 17px)',
                          fontWeight: 900,
                        }}
                      >
                        התשובה לא נכונה - אין כרטיס להגרלה
                      </div>
                      <div
                        style={{ fontSize: 'clamp(12px, 2.7cqw, 15px)', fontWeight: 700, color: '#7D706A' }}
                      >
                        {feedback.actionName}
                      </div>
                    </>
                  ) : feedback.kind === 'duplicate' ? (
                    // Not a failure - the scan scored as usual. They simply
                    // cannot be in the hat twice, and should hear that as a
                    // friendly "you're already in" rather than a rejection.
                    <>
                      <div style={{ fontSize: 'clamp(40px, 9cqw, 64px)', lineHeight: 1 }} aria-hidden="true">
                        ✅
                      </div>
                      <div
                        style={{ fontSize: 'clamp(20px, 5cqw, 30px)', fontWeight: 900, color: '#2E221E' }}
                      >
                        {feedback.participantName}
                      </div>
                      <div
                        className="rounded-full px-5 py-2"
                        style={{
                          background: 'rgba(62,143,136,0.12)',
                          color: '#2F6F69',
                          fontSize: 'clamp(13px, 3cqw, 17px)',
                          fontWeight: 900,
                        }}
                      >
                        כבר בהגרלה 🎟️
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 'clamp(34px, 8cqw, 54px)', lineHeight: 1 }} aria-hidden="true">
                        🚫
                      </div>
                      <div
                        style={{ fontSize: 'clamp(14px, 3.4cqw, 19px)', fontWeight: 800, color: '#B4231A', lineHeight: 1.4 }}
                      >
                        {feedback.message}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          }
        />
      </div>

      {/* One number, because there is only one: a ticket each means the people
          who scanned and the tickets in the hat are the same count. */}
      <div className="flex shrink-0 items-stretch justify-center">
        <CountTile
          value={participants}
          label="משתתפים בהגרלה"
          color="#E07A3E"
          live
          reduceMotion={!!reduceMotion}
        />
      </div>
    </div>
  )
}

/** A kiosk stat tile, sized for the projector. */
function CountTile({
  value,
  label,
  color,
  live = false,
  reduceMotion,
}: {
  value: number
  label: string
  color: string
  /** Announce changes - true for the count the draw actually runs on. */
  live?: boolean
  reduceMotion: boolean
}) {
  return (
    <div
      className="kiosk-fadeUp flex min-w-[150px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-3"
      style={{ boxShadow: '0 6px 18px rgba(120,50,10,0.14)' }}
    >
      <motion.div
        key={value}
        className="tabular-nums leading-none"
        style={{ fontSize: 'clamp(30px, 3.4vw, 46px)', fontWeight: 900, color }}
        initial={reduceMotion ? false : { scale: 1.16 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        aria-live={live ? 'polite' : undefined}
      >
        {value.toLocaleString('he-IL')}
      </motion.div>
      <div style={{ fontSize: 'clamp(11px, 1vw, 14px)', fontWeight: 800, color: '#B5623C', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}
