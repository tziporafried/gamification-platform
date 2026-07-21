import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Gift, Pencil, Play, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  trackLotteryEligibilitySet,
  trackLotteryLaunchBlocked,
  trackLotteryLaunched,
  trackLotteryPrizeConfirmed,
  trackLotterySetupView,
} from '@/lib/analytics'
import { useLotteryPresentationSound } from '@/hooks/useLotteryPresentationSound'
import {
  type EligibleParticipant,
  type LotteryConfig,
  type LotteryEligibilityMode,
} from '../types'
import { useEligibleParticipants } from '../useEligibleParticipants'
import { LotteryBroadcastLayout } from './LotteryBroadcastLayout'
import { LotteryPreparingStage } from './LotteryPreparingStage'

interface LotteryConfigurationCardProps {
  eventId: string
  /** Start the audience presentation in this same broadcast tab. */
  onLaunch: (payload: {
    config: LotteryConfig
    participants: EligibleParticipant[]
  }) => void
}

const DOCK_TILE_H = 'h-[5.5rem]'

const CONSOLE_CONTROL_BASE = cn(
  'group flex min-w-0 flex-1 items-center gap-2 rounded-2xl',
  DOCK_TILE_H,
  'border border-white/70 bg-white/55 px-2.5 py-1.5',
  'shadow-[0_4px_16px_rgba(46,34,30,0.07)] backdrop-blur-md',
  'transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out',
  'hover:-translate-y-0.5 hover:border-white hover:bg-white/75',
  'hover:shadow-[0_8px_22px_rgba(46,34,30,0.12)]',
  'active:translate-y-0 active:scale-[0.99]',
)

function ConsoleControl({
  icon,
  label,
  children,
  className,
  htmlFor,
  onClick,
  asButton,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
  className?: string
  htmlFor?: string
  onClick?: () => void
  asButton?: boolean
}) {
  const content = (
    <>
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          'border border-white/40 bg-gradient-to-br from-white/90 to-white/50',
          'text-secondary-text shadow-sm',
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-right">
        <span className="text-xs font-bold tracking-wide text-muted">{label}</span>
        {children}
      </span>
    </>
  )

  if (asButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(CONSOLE_CONTROL_BASE, 'cursor-pointer text-right', className)}
      >
        {content}
      </button>
    )
  }

  const Wrapper = htmlFor ? 'label' : 'div'
  return (
    <Wrapper htmlFor={htmlFor} className={cn(CONSOLE_CONTROL_BASE, className)}>
      {content}
    </Wrapper>
  )
}

/**
 * Setup state for the lottery broadcast window:
 * preparing stage (audience) + organizer console dock.
 */
export function LotteryConfigurationCard({
  eventId,
  onLaunch,
}: LotteryConfigurationCardProps) {
  const allId = useId()
  const minId = useId()
  const prizeId = useId()
  const { playReadySting, playUiClick } = useLotteryPresentationSound()

  const [eligibilityMode, setEligibilityMode] = useState<LotteryEligibilityMode>('all')
  const [minPoints, setMinPoints] = useState(50)
  const [prizeName, setPrizeName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [editingPrize, setEditingPrize] = useState(true)
  const minPointsInputRef = useRef<HTMLInputElement>(null)
  const prizeInputRef = useRef<HTMLInputElement>(null)

  const { participants, count, loading, error } = useEligibleParticipants({
    eventId,
    mode: eligibilityMode,
    minPoints,
  })

  const trimmedPrize = prizeName.trim()
  const prizeConfirmed = trimmedPrize.length > 0 && !editingPrize

  useEffect(() => {
    trackLotterySetupView(eventId)
  }, [eventId])

  useEffect(() => {
    if (editingPrize) {
      requestAnimationFrame(() => prizeInputRef.current?.focus())
    }
  }, [editingPrize])

  useEffect(() => {
    if (eligibilityMode !== 'min_points') return
    requestAnimationFrame(() => minPointsInputRef.current?.focus())
  }, [eligibilityMode])

  function selectMinPointsMode() {
    setEligibilityMode('min_points')
    trackLotteryEligibilitySet({
      eventId,
      mode: 'min_points',
      minPoints,
    })
  }

  function handleMinPointsChange(raw: string) {
    if (raw === '') {
      setMinPoints(1)
      return
    }
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return
    setMinPoints(parsed)
  }

  function commitPrize() {
    if (!prizeName.trim()) return
    setEditingPrize(false)
    trackLotteryPrizeConfirmed(eventId)
  }

  function buildConfig(): LotteryConfig | null {
    setFormError(null)
    if (!trimmedPrize) {
      setFormError('חסר שם לפרס')
      setEditingPrize(true)
      trackLotteryLaunchBlocked({ eventId, reason: 'missing_prize' })
      return null
    }
    if (count < 1) {
      setFormError('עדיין אין משתתפים בהגרלה')
      trackLotteryLaunchBlocked({ eventId, reason: 'no_eligible' })
      return null
    }
    return {
      kind: 'lottery',
      eventId,
      eligibilityMode,
      minPoints: eligibilityMode === 'all' ? 0 : minPoints,
      prizeName: trimmedPrize,
      prizeIcon: '🎁',
    }
  }

  function launchLottery() {
    const config = buildConfig()
    if (!config) return

    playUiClick()
    playReadySting()
    trackLotteryLaunched({
      eventId,
      eligibilityMode: config.eligibilityMode,
      minPoints: config.minPoints,
      eligibleCount: participants.length,
    })
    onLaunch({ config, participants })
  }

  return (
    <LotteryBroadcastLayout
      stage={<LotteryPreparingStage />}
      dock={
        <div className="relative flex w-full items-stretch gap-2 sm:gap-2.5">
          {/* Prize */}
          {prizeConfirmed ? (
            <ConsoleControl
              asButton
              onClick={() => setEditingPrize(true)}
              icon={
                <span className="text-xl leading-none" aria-hidden="true">
                  🎁
                </span>
              }
              label="הפרס"
              className="flex-[1.35]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate text-base font-black text-foreground">
                  {trimmedPrize}
                </span>
                <Pencil
                  size={14}
                  strokeWidth={2.25}
                  className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </span>
            </ConsoleControl>
          ) : (
            <ConsoleControl
              htmlFor={prizeId}
              icon={<Gift size={20} strokeWidth={2.25} />}
              label="פרס האירוע"
              className="flex-[1.35]"
            >
              <input
                ref={prizeInputRef}
                id={prizeId}
                value={prizeName}
                onChange={(e) => setPrizeName(e.target.value)}
                onBlur={commitPrize}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitPrize()
                  }
                }}
                maxLength={80}
                placeholder="הקלידו שם פרס…"
                className={cn(
                  'w-full border-0 bg-transparent p-0 text-base font-black text-foreground',
                  'placeholder:font-semibold placeholder:text-muted/70',
                  'focus:outline-none focus-visible:ring-0',
                )}
              />
            </ConsoleControl>
          )}

          {/* Eligibility — always-visible toggle */}
          <div
            className={cn(
              CONSOLE_CONTROL_BASE,
              'h-auto min-h-[5.5rem] flex-[1.55] items-start py-2.5',
            )}
          >
            <span
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                'border border-white/40 bg-gradient-to-br from-white/90 to-white/50',
                'text-secondary-text shadow-sm',
              )}
              aria-hidden="true"
            >
              <Users size={20} strokeWidth={2.25} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5 text-right">
              <span className="text-xs font-bold tracking-wide text-muted">מי משתתף?</span>

              <div
                role="radiogroup"
                aria-label="בחירת זכאות להגרלה"
                className="flex w-full flex-wrap items-center gap-1 rounded-xl bg-black/[0.05] p-1"
              >
                <button
                  type="button"
                  id={allId}
                  role="radio"
                  aria-checked={eligibilityMode === 'all'}
                  onClick={() => {
                    setEligibilityMode('all')
                    trackLotteryEligibilitySet({ eventId, mode: 'all' })
                  }}
                  className={cn(
                    'min-w-[4.5rem] flex-1 rounded-lg px-2.5 py-1.5 text-sm font-black transition-all duration-150',
                    'active:scale-[0.97]',
                    eligibilityMode === 'all'
                      ? 'border border-primary/45 bg-white text-primary shadow-sm'
                      : 'border border-transparent text-foreground/70 hover:bg-white/70 hover:text-foreground',
                  )}
                >
                  כולם
                </button>
                <div
                  id={minId}
                  role="radio"
                  tabIndex={0}
                  aria-checked={eligibilityMode === 'min_points'}
                  onClick={selectMinPointsMode}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selectMinPointsMode()
                    }
                  }}
                  className={cn(
                    'flex min-w-0 flex-[1.6] cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm font-black transition-all duration-150',
                    'active:scale-[0.97]',
                    eligibilityMode === 'min_points'
                      ? 'border border-primary/45 bg-white text-primary shadow-sm'
                      : 'border border-transparent text-foreground/70 hover:bg-white/70 hover:text-foreground',
                  )}
                >
                  <span className="shrink-0">מעל</span>
                  {eligibilityMode === 'min_points' ? (
                    <input
                      ref={minPointsInputRef}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={minPoints}
                      onChange={(e) => handleMinPointsChange(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'w-12 rounded-md border border-primary/25 bg-primary/[0.06] px-1 py-0.5',
                        'text-center text-sm font-black tabular-nums text-primary',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
                        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                      )}
                      aria-label="מינימום נקודות להשתתפות"
                    />
                  ) : (
                    <span className="inline-block min-w-12 text-center tabular-nums">
                      {minPoints.toLocaleString('he-IL')}
                    </span>
                  )}
                  <span className="shrink-0">נקודות</span>
                </div>
              </div>
            </span>
          </div>

          {/* Launch pad — scan-screen primary button language */}
          <Button
            size="md"
            variant="primary"
            className={cn(
              DOCK_TILE_H,
              'w-[8.5rem] shrink-0 flex-col gap-0.5 rounded-xl border border-transparent px-2.5',
              'text-base font-bold tracking-wide shadow-[0_10px_34px_rgba(46,34,30,0.12)]',
              'hover:opacity-95 active:scale-[0.97]',
              'disabled:pointer-events-none disabled:opacity-45',
            )}
            onClick={launchLottery}
            disabled={loading || count < 1}
            title={count < 1 && !loading ? 'אין זכאים להגרלה' : undefined}
          >
            <Play
              size={20}
              strokeWidth={2.5}
              fill="currentColor"
              className="-scale-x-100"
              aria-hidden="true"
            />
            <span className="leading-tight">התחילו בהגרלה</span>
            <span className="text-[0.7rem] font-bold tabular-nums leading-none opacity-90">
              {loading ? '…' : `${count.toLocaleString('he-IL')} זכאים`}
            </span>
          </Button>

          {(formError || error) && (
            <p
              role="alert"
              className="absolute start-0 top-0 text-xs font-medium text-danger-text"
            >
              {formError || error}
            </p>
          )}
        </div>
      }
    />
  )
}
