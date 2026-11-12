import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeBonusPoints } from '@/lib/bonusPoints'
import {
  FLASH_DEFAULT_DURATION,
  FLASH_DEFAULT_PODIUM_BONUS,
  FLASH_DEFAULT_POINTS,
  FLASH_DURATIONS,
  FLASH_TITLE_MAX_LENGTH,
  validateFlashDraft,
} from '@/lib/flashChallenge/flashChallenge'
import type { FlashChallengeDraft } from './flashChallengeStore'
import { primeFlashSfx } from './flashSfx'

interface FlashSetupStageProps {
  onLaunch: (draft: FlashChallengeDraft) => void
  /** Why scanning will not work here, when it will not - said before launching. */
  blockedReason?: string | null
  /** Event scan_mode - which card the explanation tells the operator to scan. */
  scanMode?: string | null
}

const PODIUM_MEDALS = ['🥇', '🥈', '🥉']

/**
 * The organizer's short form before the challenge starts, on the projector
 * itself - in the lottery setup's visual language (LotterySettingStage): one
 * warm card, centered, the action at the bottom.
 */
export function FlashSetupStage({ onLaunch, blockedReason, scanMode }: FlashSetupStageProps) {
  const [title, setTitle] = useState('')
  const [durationSec, setDurationSec] = useState<number>(FLASH_DEFAULT_DURATION)
  const [points, setPoints] = useState(String(FLASH_DEFAULT_POINTS))
  const [podiumOn, setPodiumOn] = useState(false)
  const [podium, setPodium] = useState<string[]>(FLASH_DEFAULT_PODIUM_BONUS.map(String))

  const valid = validateFlashDraft({ title, durationSec, points })

  function launch() {
    if (!valid.ok) return
    // The click is the user gesture that lets the intro's first sound play on time.
    primeFlashSfx()
    onLaunch({
      title: valid.title,
      durationSec: valid.durationSec,
      points: valid.points,
      ...(podiumOn ? { podiumBonus: podium.map((p) => Number(p) || 0) } : {}),
    })
  }

  return (
    <div className="flex w-full items-center justify-center">
      <motion.form
        className="relative w-full max-w-2xl"
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        onSubmit={(e) => {
          e.preventDefault()
          launch()
        }}
      >
        <div className="overflow-hidden rounded-[2rem] border-2 border-warning/40 bg-[linear-gradient(155deg,#FFFDF7_0%,#FFF1D2_48%,#FFE7D3_100%)] shadow-[0_24px_60px_rgba(46,34,30,0.16)]">
          <div aria-hidden className="h-1.5 bg-gradient-to-l from-[#FF9366] via-[#FFD68A] to-[#5FB3AA]" />

          <div className="flex flex-col gap-5 px-6 py-6 sm:px-10 sm:py-8">
            <header className="text-center">
              <p className="text-sm font-bold tracking-wide text-primary-text">⚡ אתגר בזק</p>
              <h1 className="mt-1 text-2xl font-black text-foreground sm:text-3xl">מה האתגר?</h1>
            </header>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, FLASH_TITLE_MAX_LENGTH))}
              placeholder="למשל: צלמו סלפי קבוצתי"
              maxLength={FLASH_TITLE_MAX_LENGTH}
              autoFocus
              aria-label="מה האתגר?"
              className="w-full rounded-xl border-2 border-border-strong/40 bg-white px-4 py-3 text-center text-xl font-black text-foreground outline-none placeholder:font-semibold placeholder:text-muted/70 focus:border-primary"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Duration */}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-black text-foreground">כמה זמן?</legend>
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/70 p-1 ring-1 ring-border">
                  {FLASH_DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationSec(d)}
                      aria-pressed={durationSec === d}
                      className={cn(
                        'rounded-lg py-2 text-sm font-black transition-colors',
                        durationSec === d ? 'bg-primary text-white shadow-sm' : 'text-foreground hover:bg-white',
                      )}
                    >
                      {d / 60} דק׳
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Points */}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-black text-foreground">כמה נקודות?</span>
                <input
                  value={points}
                  onChange={(e) => setPoints(sanitizeBonusPoints(e.target.value))}
                  inputMode="numeric"
                  className="w-full rounded-xl border-2 border-border-strong/40 bg-white px-4 py-2 text-center text-xl font-black tabular-nums text-foreground outline-none focus:border-primary"
                />
              </label>
            </div>

            {/* How a completion is recorded - said once, here, to the operator who
                will run it, rather than to the room on the scan screen. */}
            <div className="rounded-xl bg-white/60 px-4 py-3 text-start ring-1 ring-border">
              <p className="text-sm font-black text-foreground">איך זה עובד?</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-muted">
                {scanMode === 'split'
                  ? 'מי שהשלים את האתגר סורק את כרטיס המשתתף שלו.'
                  : 'כל משתתף שהשלים את האתגר סורק כרטיס שלו - לא משנה של איזו משימה.'}
              </p>
            </div>

            {/* Podium bonus */}
            <div className="flex flex-col gap-2.5 rounded-xl bg-white/60 px-4 py-3 ring-1 ring-border">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-sm font-black text-foreground">
                  בונוס לזריזים
                  <span className="ms-2 text-xs font-semibold text-muted">נקודות נוספות לשלושת הראשונים</span>
                </span>
                <input
                  type="checkbox"
                  checked={podiumOn}
                  onChange={(e) => setPodiumOn(e.target.checked)}
                  className="h-5 w-5 accent-[var(--color-primary)]"
                />
              </label>
              {podiumOn && (
                <div className="grid grid-cols-3 gap-2">
                  {podium.map((value, i) => (
                    <label key={i} className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 ring-1 ring-border">
                      <span aria-hidden="true">{PODIUM_MEDALS[i]}</span>
                      <span className="text-sm font-bold text-muted">+</span>
                      <input
                        value={value}
                        onChange={(e) =>
                          setPodium((prev) => prev.map((p, j) => (j === i ? sanitizeBonusPoints(e.target.value) : p)))
                        }
                        inputMode="numeric"
                        aria-label={`בונוס למקום ${i + 1}`}
                        className="w-full min-w-0 bg-transparent text-center font-black tabular-nums text-foreground outline-none"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {blockedReason && (
              <p className="rounded-xl bg-danger/10 px-4 py-2 text-center text-sm font-bold text-danger-text" role="status">
                {blockedReason}
              </p>
            )}

            <button
              type="submit"
              disabled={!valid.ok}
              className={cn(
                'flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-xl font-black text-white',
                'shadow-[0_14px_36px_rgba(46,34,30,0.18)] transition-all hover:opacity-95 active:scale-[0.98]',
                'disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none',
              )}
            >
              <Zap size={22} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
              הפעילו אתגר!
            </button>
          </div>
        </div>
      </motion.form>
    </div>
  )
}
