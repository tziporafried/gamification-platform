import { useId, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import { useLotteryPresentationSound } from '@/hooks/useLotteryPresentationSound'
import {
  type EligibleParticipant,
  type LotteryConfig,
  type LotteryEligibilityMode,
} from '../types'
import { useEligibleParticipants } from '../useEligibleParticipants'
import { getLotteryWinnerIds } from './lotteryWinners'
import { LotterySettingStage } from './LotterySettingStage'

type ConfigStep = 'welcome' | 'eligibility' | 'prize' | 'ready'

const TOTAL_STEPS = 4

function buildEligibilityRule(
  mode: LotteryEligibilityMode,
  minPoints: number,
): string {
  if (mode === 'all') return 'כולם במשחק!'
  return `מי שצבר לפחות ${minPoints.toLocaleString('he-IL')} נקודות`
}

interface LotteryConfigurationCardProps {
  eventId: string
  /** Start the audience presentation in this same broadcast tab. */
  onLaunch: (payload: {
    config: LotteryConfig
    participants: EligibleParticipant[]
  }) => void
}

export function LotteryConfigurationCard({
  eventId,
  onLaunch,
}: LotteryConfigurationCardProps) {
  const allId = useId()
  const minId = useId()
  const excludeId = useId()
  const { playStepChime, playReadySting } = useLotteryPresentationSound()

  const [step, setStep] = useState<ConfigStep>('welcome')
  const [eligibilityMode, setEligibilityMode] = useState<LotteryEligibilityMode>('min_points')
  const [minPoints, setMinPoints] = useState(50)
  const [prizeName, setPrizeName] = useState('')
  const [excludePreviousWinners, setExcludePreviousWinners] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [winnersVersion, setWinnersVersion] = useState(0)

  const excludeIds = useMemo(() => {
    if (!excludePreviousWinners) return undefined
    return getLotteryWinnerIds(eventId)
  }, [eventId, excludePreviousWinners, winnersVersion])

  const { participants, count, loading, error } = useEligibleParticipants({
    eventId,
    mode: eligibilityMode,
    minPoints,
    excludeIds,
  })

  const trimmedPrize = prizeName.trim()
  const eligibilityRule = buildEligibilityRule(eligibilityMode, minPoints)

  function handleMinPointsChange(raw: string) {
    if (raw === '') {
      setMinPoints(1)
      return
    }
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return
    setMinPoints(parsed)
  }

  function goNext(next: ConfigStep) {
    playStepChime()
    setFormError(null)
    setStep(next)
  }

  function buildConfig(): LotteryConfig | null {
    setFormError(null)
    if (!trimmedPrize) {
      setFormError('חסר שם לפרס')
      return null
    }
    if (count < 1) {
      setFormError('עדיין אין משתתפים בהגרלה')
      return null
    }
    return {
      kind: 'lottery',
      eventId,
      eligibilityMode,
      minPoints: eligibilityMode === 'all' ? 0 : minPoints,
      prizeName: trimmedPrize,
      prizeIcon: '🎁',
      excludePreviousWinners,
    }
  }

  function launchLottery() {
    const config = buildConfig()
    if (!config) return

    playReadySting()
    setWinnersVersion((v) => v + 1)
    onLaunch({ config, participants })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <LotterySettingStage key="welcome" eyebrow="מוכנים??" step={1} totalSteps={TOTAL_STEPS}>
            <motion.h2
              className="text-5xl font-black text-foreground sm:text-6xl"
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              🎁 הגרלה
            </motion.h2>
            <p className="mx-auto mt-4 max-w-md text-base font-semibold leading-relaxed text-muted sm:text-lg">
              הולכת להתחיל הגרלה ענקית - מי יזכה??
            </p>
            <div className="mt-8">
              <Button
                size="lg"
                variant="gradient"
                className="min-w-[12rem] text-base font-black"
                onClick={() => {
                  playReadySting()
                  setFormError(null)
                  setStep('eligibility')
                }}
              >
                יאללה נתחיל!
              </Button>
            </div>
          </LotterySettingStage>
        )}

        {step === 'eligibility' && (
          <LotterySettingStage key="eligibility" eyebrow="מי במשחק??" step={2} totalSteps={TOTAL_STEPS}>
            <div className="mx-auto grid w-full max-w-xl gap-3 sm:grid-cols-2">
              <label
                htmlFor={allId}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 px-4 py-6 transition-colors',
                  eligibilityMode === 'all'
                    ? 'border-primary bg-white/80 shadow-sm'
                    : 'border-border/80 bg-white/45 hover:border-accent',
                )}
              >
                <input
                  id={allId}
                  type="radio"
                  name="lottery-eligibility"
                  checked={eligibilityMode === 'all'}
                  onChange={() => setEligibilityMode('all')}
                  className={cn('h-5 w-5 shrink-0', theme.checkbox)}
                />
                <span className="text-lg font-black text-foreground">כולם במשחק!</span>
              </label>

              <label
                htmlFor={minId}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 px-4 py-6 transition-colors',
                  eligibilityMode === 'min_points'
                    ? 'border-primary bg-white/80 shadow-sm'
                    : 'border-border/80 bg-white/45 hover:border-accent',
                )}
              >
                <input
                  id={minId}
                  type="radio"
                  name="lottery-eligibility"
                  checked={eligibilityMode === 'min_points'}
                  onChange={() => setEligibilityMode('min_points')}
                  className={cn('h-5 w-5 shrink-0', theme.checkbox)}
                />
                <span className="text-base font-bold text-foreground">מי שצבר נקודות</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={minPoints}
                    disabled={eligibilityMode !== 'min_points'}
                    onChange={(e) => handleMinPointsChange(e.target.value)}
                    onClick={() => setEligibilityMode('min_points')}
                    className={cn(
                      'w-20 rounded-xl border-2 px-2 py-2 text-center text-2xl font-black tabular-nums',
                      theme.inputBg,
                      theme.text,
                      theme.inputBorder,
                      theme.focusRing,
                      theme.focusBorder,
                      eligibilityMode !== 'min_points' && 'opacity-50',
                    )}
                    aria-label="מינימום נקודות"
                  />
                  <span className="text-base font-bold text-foreground">נק׳</span>
                </div>
              </label>
            </div>

            <div className="mx-auto mt-5 max-w-md text-start">
              <Checkbox
                id={excludeId}
                label="בלי זוכים מהגרלות קודמות"
                checked={excludePreviousWinners}
                onChange={(e) => setExcludePreviousWinners(e.target.checked)}
              />
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm font-medium text-danger-text">
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button variant="ghost" size="lg" className="font-bold" onClick={() => setStep('welcome')}>
                רגע אחורה
              </Button>
              <Button
                size="lg"
                variant="gradient"
                className="min-w-[10rem] text-base font-black"
                onClick={() => goNext('prize')}
              >
                הלאה!
              </Button>
            </div>
          </LotterySettingStage>
        )}

        {step === 'prize' && (
          <LotterySettingStage key="prize" eyebrow="ומה מרוויחים??" step={3} totalSteps={TOTAL_STEPS}>
            <span className="mb-4 block text-5xl sm:text-6xl" aria-hidden>
              🎁
            </span>
            <input
              value={prizeName}
              onChange={(e) => setPrizeName(e.target.value)}
              maxLength={80}
              placeholder="הפרס הגדול…"
              aria-label="הפרס"
              className={cn(
                'mx-auto block w-full max-w-md rounded-2xl border-2 px-5 py-4 text-center text-2xl font-black',
                'placeholder:font-semibold placeholder:text-muted',
                theme.inputBg,
                theme.text,
                theme.inputBorder,
                theme.focusRing,
                theme.focusBorder,
              )}
            />

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="lg"
                className="font-bold"
                onClick={() => setStep('eligibility')}
              >
                רגע אחורה
              </Button>
              <Button
                size="lg"
                variant="gradient"
                className="min-w-[10rem] text-base font-black"
                disabled={!trimmedPrize}
                onClick={() => {
                  if (!trimmedPrize) {
                    setFormError('חסר שם לפרס')
                    return
                  }
                  goNext('ready')
                }}
              >
                הלאה!
              </Button>
            </div>
            {formError && step === 'prize' && (
              <p role="alert" className="mt-3 text-sm font-medium text-danger-text">
                {formError}
              </p>
            )}
          </LotterySettingStage>
        )}

        {step === 'ready' && (
          <LotterySettingStage key="ready" eyebrow="מוכנים??" step={4} totalSteps={TOTAL_STEPS}>
            <dl className="mx-auto w-full max-w-md space-y-4 text-center">
              <div>
                <dt className="text-sm font-bold text-muted">מי במשחק</dt>
                <dd className="mt-1 text-2xl font-black text-foreground sm:text-3xl">
                  {eligibilityRule}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-muted">פתקים בקופסה</dt>
                <dd className="mt-1 text-4xl font-black tabular-nums text-foreground sm:text-5xl">
                  {loading ? '…' : count.toLocaleString('he-IL')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-muted">הפרס</dt>
                <dd className="mt-1 text-2xl font-black text-foreground sm:text-3xl">
                  🎁 {trimmedPrize}
                </dd>
              </div>
            </dl>

            <p className="mx-auto mt-6 max-w-sm text-base font-black text-primary-text sm:text-lg">
              יאללה… בוחרים זוכה!!
            </p>

            {formError && (
              <p role="alert" className="mt-3 text-sm font-medium text-danger-text">
                {formError}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button variant="ghost" size="lg" className="font-bold" onClick={() => setStep('prize')}>
                רגע אחורה
              </Button>
              <Button
                size="lg"
                variant="gradient"
                className="min-w-[14rem] text-base font-black tracking-wide"
                onClick={launchLottery}
                disabled={loading}
              >
                נתחילים!!!
              </Button>
            </div>
          </LotterySettingStage>
        )}
      </AnimatePresence>
    </div>
  )
}
