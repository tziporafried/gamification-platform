import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The wizard's two-way choice control, first built for «איך תרצו לשחק?» in
 * StepGroups and now shared with the cards step: one bordered strip, a divider
 * down the middle and a tinted panel that slides to whichever half is chosen.
 *
 * Two options exactly - the sliding indicator is positioned as halves, and a
 * third segment would have nowhere to go.
 */
export interface SegmentedChoiceOption<T extends string> {
  value: T
  label: string
  /** ReactNode so a caller can break it where the sentences break. */
  description?: ReactNode
  /** Optional closing line under the description - counts, prices, etc. */
  detail?: ReactNode
  icon: LucideIcon
}

interface WizardSegmentedChoiceProps<T extends string> {
  ariaLabel: string
  options: [SegmentedChoiceOption<T>, SegmentedChoiceOption<T>]
  value: T | null
  onSelect: (value: T) => void
  /** Row form for use as a list header, once the choice has been made. */
  compact?: boolean
  /**
   * Trades the generous padding and the narrow text column for room to read:
   * lines that would otherwise wrap - a breakdown, a total - stay on one line.
   * The wide form stays the default; the groups step is built around it.
   */
  dense?: boolean
  /**
   * Puts the weight on the description rather than on the detail under it -
   * for options where the sentence is what explains the choice and the numbers
   * are only supporting evidence.
   */
  emphasizeDescription?: boolean
}

const SELECTED_SEGMENT_STYLES = {
  indicator:
    'bg-[color-mix(in_srgb,var(--color-tertiary)_11%,var(--color-surface))]',
  icon: 'text-tertiary-text',
  title: 'text-[color-mix(in_srgb,var(--color-tertiary)_88%,var(--color-foreground))]',
  description: 'text-muted/58',
} as const

export function WizardSegmentedChoice<T extends string>({
  ariaLabel,
  options,
  value,
  onSelect,
  compact = false,
  dense = false,
  emphasizeDescription = false,
}: WizardSegmentedChoiceProps<T>) {
  const selectedIndex = options.findIndex((option) => option.value === value)
  const hasSelection = selectedIndex >= 0

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'relative grid grid-cols-2 items-stretch gap-0 border border-border bg-surface-elevated p-1',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.06)]',
        'transition-[box-shadow,border-color] duration-200 ease-out',
        compact ? 'rounded-xl' : 'rounded-2xl',
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-4 bottom-4 start-1/2 z-20 w-px -translate-x-1/2 bg-border/70"
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute rounded-xl',
          SELECTED_SEGMENT_STYLES.indicator,
          'transition-[inset-inline-start,inset-inline-end,opacity,background-color] duration-200 ease-out',
          compact ? 'top-1.5 bottom-1.5' : 'top-2 bottom-2',
          !hasSelection && 'opacity-0',
          selectedIndex === 0 && 'start-1.5 end-[calc(50%+1px)]',
          selectedIndex === 1 && 'start-[calc(50%+1px)] end-1.5',
        )}
      />

      {options.map(({ value: optionValue, label, description, detail, icon: Icon }) => {
        const isSelected = value === optionValue

        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(optionValue)}
            className={cn(
              'group/segment relative z-10 flex h-full w-full min-w-0 cursor-pointer items-center justify-center text-center',
              'rounded-xl transition-[color,background-color] duration-200 ease-out',
              // No alpha modifier on the ring colour: the palette is raw
              // `var(--color-*)` without an <alpha-value>, so `ring-tertiary/35`
              // is never generated and `ring-1` falls back to Tailwind's own
              // blue - a stray blue frame on focus.
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-tertiary focus-visible:ring-offset-0',
              compact
                ? 'min-h-[2.375rem] flex-row gap-2.5 px-4 py-2.5'
                : dense
                  ? 'min-h-[9.5rem] flex-col gap-3 px-2.5 py-5'
                  : 'min-h-[9.5rem] flex-col gap-6 px-7 py-7',
              isSelected
                ? SELECTED_SEGMENT_STYLES.title
                : cn(
                    'text-foreground/85',
                    'hover:bg-[color-mix(in_srgb,var(--color-foreground)_3%,var(--color-surface))]',
                  ),
            )}
          >
            <span
              className={cn(
                'inline-flex shrink-0 items-center justify-center transition-colors duration-200 ease-out',
                compact ? 'h-6 w-6' : dense ? 'h-9 w-9' : 'h-[3.25rem] w-[3.25rem]',
              )}
            >
              <Icon
                size={compact ? 25 : dense ? 36 : 52}
                strokeWidth={compact ? 2 : 1.55}
                className={cn(
                  'shrink-0 transition-colors duration-200 ease-out',
                  isSelected ? SELECTED_SEGMENT_STYLES.icon : 'text-muted/68',
                )}
              />
            </span>
            <div
              className={cn(
                'flex min-w-0 flex-col items-center',
                !compact && (dense ? 'w-full' : 'max-w-[11.5rem]'),
              )}
            >
              <span
                className={cn(
                  'block transition-colors duration-200 ease-out',
                  compact
                    ? cn('text-xs leading-tight', isSelected ? 'font-bold' : 'font-semibold')
                    : cn('text-base leading-snug', isSelected ? 'font-bold' : 'font-semibold'),
                )}
              >
                {label}
              </span>
              {!compact && description && (
                <span
                  className={cn(
                    'block leading-relaxed transition-colors duration-200 ease-out',
                    // The two-line reserve keeps the wide segments level with
                    // each other; dense ones are one-liners and need no floor.
                    dense ? 'mt-2' : 'mt-3 min-h-[2.75rem]',
                    emphasizeDescription
                      ? cn('text-[13px] font-semibold', isSelected ? SELECTED_SEGMENT_STYLES.title : 'text-foreground/90')
                      : cn(
                          'text-[11px] font-normal',
                          isSelected ? SELECTED_SEGMENT_STYLES.description : 'text-muted/62',
                        ),
                  )}
                >
                  {description}
                </span>
              )}
              {!compact && detail && (
                <span
                  className={cn(
                    'mt-2 block leading-relaxed',
                    emphasizeDescription
                      ? 'text-[11px] font-normal text-muted'
                      : 'text-xs font-semibold text-foreground/80',
                  )}
                >
                  {detail}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
