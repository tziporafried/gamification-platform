import { useEffect, useId, useRef } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SETTINGS_FIELD, SettingsSection } from './LotterySettingsBar'

interface LotteryPrizeControlProps {
  value: string
  onChange: (value: string) => void
  /** Called when the operator finishes typing (blur or Enter) with a name. */
  onCommit: () => void
  /** True while the field is being typed into; false shows the confirmed name. */
  editing: boolean
  onEdit: () => void
}

/**
 * The prize - the first thing the eye should land on, so it leads the bar.
 *
 * Its two faces are the same size and sit on the same line: a field while the
 * name is being chosen, and the name itself once confirmed. Swapping between
 * them moves nothing.
 */
export function LotteryPrizeControl({
  value,
  onChange,
  onCommit,
  editing,
  onEdit,
}: LotteryPrizeControlProps) {
  const prizeId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const trimmed = value.trim()
  const confirmed = trimmed.length > 0 && !editing

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [editing])

  return (
    // No secondary row content: the label already says what the field is, and
    // a hint under it would be words for their own sake. The row itself stays
    // reserved, so this section keeps the same height as the others.
    <SettingsSection label="מה מגרילים?">
      {confirmed ? (
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            SETTINGS_FIELD,
            'group flex items-center gap-2 text-right',
            'hover:border-black/[0.14] hover:bg-white/85',
          )}
        >
          <span className="text-base leading-none" aria-hidden="true">
            🎁
          </span>
          <span className="min-w-0 flex-1 truncate">{trimmed}</span>
          <Pencil
            size={14}
            strokeWidth={2.25}
            className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </button>
      ) : (
        <>
          <label htmlFor={prizeId} className="sr-only">
            שם הפרס
          </label>
          <input
            ref={inputRef}
            id={prizeId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onCommit()
              }
            }}
            maxLength={80}
            placeholder="הקלידו שם פרס…"
            className={SETTINGS_FIELD}
          />
        </>
      )}
    </SettingsSection>
  )
}
