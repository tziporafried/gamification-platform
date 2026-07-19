import { useId, useMemo, useState } from 'react'
import { Gift } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import {
  type LotteryConfig,
  type LotteryEligibilityMode,
} from '../types'
import { useEligibleParticipants } from '../useEligibleParticipants'
import { getLotteryWinnerIds } from './lotteryWinners'
import { lotteryPresentationPath, saveLotterySession } from './lotterySession'

type LotteryLaunchAction = 'save_ready' | 'start_now'

interface LotteryConfigurationCardProps {
  eventId: string
  /** After a successful start — return to the Live Events hub. */
  onStarted?: () => void
}

function buildEligibilityRule(
  mode: LotteryEligibilityMode,
  minPoints: number,
): string {
  if (mode === 'all') return 'כל המשתתפים'
  return `כל משתתף שצבר לפחות ${minPoints.toLocaleString('he-IL')} נקודות`
}

export function LotteryConfigurationCard({
  eventId,
  onStarted,
}: LotteryConfigurationCardProps) {
  const allId = useId()
  const minId = useId()
  const excludeId = useId()

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

  function buildConfig(): LotteryConfig | null {
    setFormError(null)
    if (!trimmedPrize) {
      setFormError('נא להזין שם פרס.')
      return null
    }
    if (count < 1) {
      setFormError('אין משתתפים זכאים להגרלה.')
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

  /** Shared launch path — ready for "Save as Ready" without changing Start Now UX. */
  function launchLottery(action: LotteryLaunchAction) {
    const config = buildConfig()
    if (!config) return

    if (action === 'save_ready') {
      // Reserved: persist a ready lottery without opening presentation.
      return
    }

    const runId = saveLotterySession({ config, participants })
    const path = lotteryPresentationPath(eventId, runId)
    // Do not pass "noopener" as a feature — browsers then return null even on success,
    // which blocked returning to the Live Events hub.
    const opened = window.open(path, '_blank')
    if (!opened) {
      setFormError('לא ניתן לפתוח טאב חדש. בדקו חסימת חלונות קופצים.')
      return
    }
    opened.opener = null
    setWinnersVersion((v) => v + 1)
    onStarted?.()
  }

  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[1.75rem] border-2 border-warning/30 bg-white/78 shadow-[0_18px_54px_rgba(46,34,30,0.1)] backdrop-blur">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-[#FF9366] via-[#FFD68A] to-[#5FB3AA]"
      />

      <div className="space-y-8 p-6 pt-7 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary-text shadow-sm">
            <Gift size={26} strokeWidth={2.25} />
          </div>
          <h2 className="text-2xl font-black text-foreground">🎁 הגרלה</h2>
          <p className="mt-1.5 text-sm font-medium text-muted">
            הכינו את ההגרלה לפני השידור — מי נכנס ומה הפרס
          </p>
        </div>

        <section className="space-y-3">
          <h3 className={cn('text-base font-bold', theme.text)}>מי משתתף?</h3>

          <div className="grid gap-2 sm:grid-cols-2">
            <label
              htmlFor={allId}
              className={cn(
                'flex h-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                eligibilityMode === 'all'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-surface hover:border-accent',
              )}
            >
              <input
                id={allId}
                type="radio"
                name="lottery-eligibility"
                checked={eligibilityMode === 'all'}
                onChange={() => setEligibilityMode('all')}
                className={cn('h-4 w-4 shrink-0', theme.checkbox)}
              />
              <span className={cn('text-sm font-medium', theme.text)}>כל המשתתפים</span>
            </label>

            <label
              htmlFor={minId}
              className={cn(
                'flex h-full cursor-pointer flex-wrap items-center gap-2 rounded-xl border px-4 py-3 transition-colors',
                eligibilityMode === 'min_points'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-surface hover:border-accent',
              )}
            >
              <input
                id={minId}
                type="radio"
                name="lottery-eligibility"
                checked={eligibilityMode === 'min_points'}
                onChange={() => setEligibilityMode('min_points')}
                className={cn('h-4 w-4 shrink-0', theme.checkbox)}
              />
              <span className={cn('text-sm font-medium', theme.text)}>
                כל משתתף שצבר לפחות
              </span>
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
                  'w-16 rounded-lg border px-2 py-1.5 text-center text-sm font-bold tabular-nums',
                  theme.inputBg,
                  theme.text,
                  theme.inputBorder,
                  theme.focusRing,
                  theme.focusBorder,
                  eligibilityMode !== 'min_points' && 'opacity-50',
                )}
                aria-label="מינימום נקודות"
              />
              <span className={cn('text-sm font-medium', theme.text)}>נקודות</span>
            </label>
          </div>

          <Checkbox
            id={excludeId}
            label="מניעת השתתפות של זוכי הגרלות קודמות"
            checked={excludePreviousWinners}
            onChange={(e) => setExcludePreviousWinners(e.target.checked)}
          />

          {error && (
            <p role="alert" className="text-sm font-medium text-danger-text">
              {error}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className={cn('text-base font-bold', theme.text)}>הפרס</h3>
          <Input
            placeholder="שם הפרס"
            value={prizeName}
            onChange={(e) => setPrizeName(e.target.value)}
            maxLength={80}
            aria-label="הפרס"
          />
        </section>

        <section
          className="space-y-3 rounded-2xl border border-warning/25 bg-[linear-gradient(150deg,#FFFDF7,#FFF1D2)] p-5"
          aria-label="סיכום ההגרלה"
        >
          <h3 className={cn('text-base font-bold', theme.text)}>מוכנים לשדר?</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className={theme.textMuted}>כלל הזכאות</dt>
              <dd className={cn('max-w-[65%] text-start font-semibold', theme.text)}>
                {eligibilityRule}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className={theme.textMuted}>משתתפים זכאים</dt>
              <dd className={cn('font-bold tabular-nums', theme.text)}>
                {loading ? '…' : count.toLocaleString('he-IL')}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className={theme.textMuted}>הפרס</dt>
              <dd className={cn('max-w-[65%] text-start font-semibold', trimmedPrize ? theme.text : 'text-muted')}>
                {trimmedPrize || 'טרם הוגדר'}
              </dd>
            </div>
          </dl>
        </section>

        {formError && (
          <p role="alert" className="text-sm font-medium text-danger-text">
            {formError}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {/* Future: Save as Ready via launchLottery('save_ready') */}
          <Button
            size="lg"
            variant="gradient"
            className="w-full text-base font-black tracking-wide"
            onClick={() => launchLottery('start_now')}
            disabled={loading}
          >
            התחילו עכשיו
          </Button>
        </div>
      </div>
    </div>
  )
}
