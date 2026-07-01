import { useRef, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react'
import type { AccentRgb } from '@/lib/accentColor'
import { rgba } from '@/lib/accentColor'

interface AutocompleteFieldProps<T> {
  label: string
  placeholder: string
  query: string
  onQueryChange: (value: string) => void
  selected: T | null
  onSelect: (item: T) => void
  onClear: () => void
  suggestions: T[]
  searching: boolean
  showDropdown: boolean
  onShowDropdown: (show: boolean) => void
  blurred: boolean
  onBlurred: () => void
  accent: AccentRgb
  dropdownRef: RefObject<HTMLDivElement>
  inputRef?: RefObject<HTMLInputElement>
  getKey: (item: T) => string
  renderSelected: (item: T) => ReactNode
  renderOption: (item: T) => ReactNode
  emptyMessage?: string
}

export function AutocompleteField<T>({
  label,
  placeholder,
  query,
  onQueryChange,
  selected,
  onSelect,
  onClear,
  suggestions,
  searching,
  showDropdown,
  onShowDropdown,
  blurred,
  onBlurred,
  accent,
  dropdownRef,
  inputRef,
  getKey,
  renderSelected,
  renderOption,
  emptyMessage = 'לא נמצאו תוצאות',
}: AutocompleteFieldProps<T>) {
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasQuery = query.trim().length > 0
  const isValid = selected !== null
  const isInvalid =
    !selected &&
    hasQuery &&
    !searching &&
    (blurred || suggestions.length === 0)

  const borderColor = isValid
    ? 'color-mix(in srgb, var(--color-success) 50%, transparent)'
    : isInvalid
      ? 'color-mix(in srgb, var(--color-danger) 50%, transparent)'
      : rgba(accent, 0.3)

  const showPanel = showDropdown && hasQuery && !selected

  function handleFocus() {
    if (hasQuery) onShowDropdown(true)
  }

  function handleBlur() {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    blurTimeoutRef.current = setTimeout(() => onBlurred(), 150)
  }

  function handleOptionMouseDown(e: MouseEvent) {
    e.preventDefault()
  }

  return (
    <div ref={dropdownRef}>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>

      <div className="relative">
        {selected ? (
          <div
            className="flex h-10 items-center justify-between rounded-lg border bg-surface-elevated px-3"
            style={{ borderColor: 'color-mix(in srgb, var(--color-success) 50%, transparent)' }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0 text-success" />
              {renderSelected(selected)}
            </div>
            <button
              type="button"
              onClick={onClear}
              className="mr-1 shrink-0 rounded p-0.5 text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              ref={inputRef}
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                onQueryChange(e.target.value)
                onShowDropdown(true)
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="h-10 w-full rounded-lg border bg-surface-elevated py-0 pl-3 pr-9 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-1"
              style={{
                borderColor,
                ['--tw-ring-color' as string]: isInvalid ? 'color-mix(in srgb, var(--color-danger) 50%, transparent)' : rgba(accent, 0.5),
              }}
            />
            <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
              {searching && <Loader2 size={14} className="animate-spin text-muted" />}
              {!searching && isInvalid && <AlertCircle size={14} className="text-danger" />}
            </div>
          </div>
        )}

        {showPanel && (
          <div className="absolute inset-x-0 bottom-full z-20 mb-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-xl">
            {searching ? (
              <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted">
                <Loader2 size={14} className="animate-spin" />
                מחפש...
              </div>
            ) : suggestions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted">{emptyMessage}</div>
            ) : (
              suggestions.map((item) => (
                <button
                  key={getKey(item)}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm text-foreground transition-colors hover:bg-surface"
                  onMouseDown={handleOptionMouseDown}
                  onClick={() => onSelect(item)}
                >
                  {renderOption(item)}
                </button>
              ))
            )}
          </div>
        )}

        {isInvalid && !showPanel && (
          <p className="mt-1 text-[10px] text-danger">
            {suggestions.length === 0 && hasQuery ? emptyMessage : 'יש לבחור מהרשימה'}
          </p>
        )}
      </div>
    </div>
  )
}
