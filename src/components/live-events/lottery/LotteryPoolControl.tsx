import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { LotteryEligibilityMode } from '../types'
import type { LotteryGroup } from '../useLotteryRoster'
import type { ScanLotteryRoundState } from '../useScanLotteryRound'
import { LotterySelectionPicker, type SelectionOption } from './LotterySelectionPicker'
import { ScanLotteryRoundBody } from './ScanLotteryRoundBody'
import {
  SETTINGS_INLINE_DIVIDER,
  SETTINGS_INLINE_FIELD,
  SETTINGS_SEGMENT,
  SETTINGS_SEGMENT_OFF,
  SETTINGS_SEGMENT_ON,
  SETTINGS_SEGMENT_TRACK,
  SettingsSection,
} from './LotterySettingsBar'
import { ELIGIBILITY_LABELS } from './lotteryMode'

interface LotteryPoolControlProps {
  mode: LotteryEligibilityMode
  modes: readonly LotteryEligibilityMode[]
  onModeChange: (mode: LotteryEligibilityMode) => void

  minPoints: number
  onMinPointsChange: (minPoints: number) => void

  groupIds: ReadonlySet<string>
  onGroupIdsChange: (next: Set<string>) => void
  groups: readonly LotteryGroup[]

  optionsLoading: boolean

  /** The scan round's controls - present only when 'scans' is chosen. */
  scan: ScanLotteryRoundState | null
  /** Whether the organizer has pressed start in this visit to the toggle. */
  startedScanning: boolean
  onOpenRound: () => void
  onCloseRound: () => void
  onResetRound: () => void
}

/**
 * "מי משתתף?" - the one place the organizer decides who is in the hat.
 *
 * Whatever a choice needs next opens *inside the chosen option*: the points
 * line, the group picker and the scan round each live in their own segment
 * rather than off to one side. So the control reads as one sentence - "לפי
 * נקודות · מעל 50" - instead of a toggle plus a second setting that has to be
 * mentally attached to it, and an option that needs nothing is simply shorter.
 *
 * Only the chosen segment grows, and only sideways: no height anywhere changes
 * when the choice does.
 *
 * The segments are `role="radio"` divs rather than buttons because they hold
 * real controls - an input, a picker, the round's buttons - and a button
 * cannot contain those. Clicks from inside stop there, so operating a
 * segment's contents never re-fires the choice.
 */
export function LotteryPoolControl({
  mode,
  modes,
  onModeChange,
  minPoints,
  onMinPointsChange,
  groupIds,
  onGroupIdsChange,
  groups,
  optionsLoading,
  scan,
  startedScanning,
  onOpenRound,
  onCloseRound,
  onResetRound,
}: LotteryPoolControlProps) {
  const minPointsId = useId()
  const minPointsInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode !== 'min_points') return
    requestAnimationFrame(() => minPointsInputRef.current?.focus())
  }, [mode])

  const groupOptions = useMemo<SelectionOption[]>(
    () => groups.map((g) => ({ id: g.id, label: g.name, color: g.color })),
    [groups],
  )

  function handleMinPointsChange(raw: string) {
    if (raw === '') {
      onMinPointsChange(1)
      return
    }
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < 1) return
    onMinPointsChange(parsed)
  }

  /** What the chosen option expands into. null for one that needs nothing. */
  function expansionFor(option: LotteryEligibilityMode): ReactNode {
    switch (option) {
      case 'all':
        return null

      case 'min_points':
        return (
          <>
            <span className="shrink-0 font-bold opacity-70">מעל</span>
            <input
              ref={minPointsInputRef}
              id={minPointsId}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={minPoints}
              onChange={(e) => handleMinPointsChange(e.target.value)}
              className={cn(SETTINGS_INLINE_FIELD, 'w-14')}
              aria-label="מינימום נקודות להשתתפות"
            />
            <span className="shrink-0 font-bold opacity-70">נק׳</span>
          </>
        )

      case 'groups':
        return (
          <LotterySelectionPicker
            placeholder="בחרו"
            noun="קבוצות"
            options={groupOptions}
            selected={groupIds}
            onChange={onGroupIdsChange}
            loading={optionsLoading}
            emptyText="למשחק הזה אין קבוצות"
            // A handful of groups reads fine as a list; a long one does not.
            searchable={groupOptions.length > 8}
          />
        )

      case 'scans':
        return scan ? (
          <ScanLotteryRoundBody
            scan={scan}
            started={startedScanning}
            onOpen={onOpenRound}
            onClose={onCloseRound}
            onReset={onResetRound}
          />
        ) : null
    }
  }

  return (
    <SettingsSection label="מי משתתף?">
      <div role="radiogroup" aria-label="בחירת זכאות להגרלה" className={SETTINGS_SEGMENT_TRACK}>
        {modes.map((option) => {
          const selected = option === mode
          const expansion = selected ? expansionFor(option) : null
          return (
            <div
              key={option}
              role="radio"
              tabIndex={0}
              aria-checked={selected}
              onClick={() => onModeChange(option)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                onModeChange(option)
              }}
              className={cn(SETTINGS_SEGMENT, selected ? SETTINGS_SEGMENT_ON : SETTINGS_SEGMENT_OFF)}
            >
              <span className="shrink-0">{ELIGIBILITY_LABELS[option]}</span>
              {expansion && (
                // Anything in here is a control of its own; a click on it is
                // not another vote for the option that already won.
                <span
                  className="flex min-w-0 items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={SETTINGS_INLINE_DIVIDER} aria-hidden="true" />
                  {expansion}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </SettingsSection>
  )
}
