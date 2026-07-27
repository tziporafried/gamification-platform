import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SETTINGS_BLOCK_H } from './LotterySettingsBar'

interface LotteryLaunchButtonProps {
  onClick: () => void
  disabled: boolean
  /** The pool line under the caption - eligible players, or participants. */
  countLabel: string
  loading: boolean
  /** Why it is disabled, as a hover hint. */
  title?: string
}

/**
 * The one thing in the bar that starts something, and the only filled surface
 * in it - which is what makes it read as the end of the row rather than a
 * fourth setting.
 *
 * It spans a section's whole height - label row included, since it needs no
 * label of its own - so it begins and ends on the same two lines as the
 * sections beside it.
 */
export function LotteryLaunchButton({
  onClick,
  disabled,
  countLabel,
  loading,
  title,
}: LotteryLaunchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        SETTINGS_BLOCK_H,
        'flex w-[9.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-4',
        'bg-primary text-white',
        'shadow-[0_8px_24px_rgba(46,34,30,0.16)]',
        'transition-all duration-150 hover:opacity-95 active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none',
      )}
    >
      <span className="flex items-center gap-1.5">
        <Play
          size={16}
          strokeWidth={2.5}
          fill="currentColor"
          className="-scale-x-100"
          aria-hidden="true"
        />
        <span className="text-[15px] font-black leading-none">התחילו בהגרלה</span>
      </span>
      <span className="text-[12px] font-bold leading-none tabular-nums opacity-85">
        {loading ? '…' : countLabel}
      </span>
    </button>
  )
}
