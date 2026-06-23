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
    ? 'rgba(34,197,94,0.5)'
    : isInvalid
      ? 'rgba(239,68,68,0.5)'
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
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </label>

      <div className="relative">
        {selected ? (
          <div
            className="flex h-10 items-center justify-between rounded-lg border bg-game-dark px-3"
            style={{ borderColor: 'rgba(34,197,94,0.5)' }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              {renderSelected(selected)}
            </div>
            <button
              type="button"
              onClick={onClear}
              className="mr-1 shrink-0 rounded p-0.5 text-gray-400 hover:text-white"
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
              className="h-10 w-full rounded-lg border bg-game-dark py-0 pl-3 pr-9 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1"
              style={{
                borderColor,
                ['--tw-ring-color' as string]: isInvalid ? 'rgba(239,68,68,0.5)' : rgba(accent, 0.5),
              }}
            />
            <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
              {searching && <Loader2 size={14} className="animate-spin text-gray-400" />}
              {!searching && isInvalid && <AlertCircle size={14} className="text-red-400" />}
            </div>
          </div>
        )}

        {showPanel && (
          <div className="absolute inset-x-0 bottom-full z-20 mb-1 max-h-48 overflow-y-auto rounded-lg border border-game-border bg-game-dark shadow-xl">
            {searching ? (
              <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                מחפש...
              </div>
            ) : suggestions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-500">{emptyMessage}</div>
            ) : (
              suggestions.map((item) => (
                <button
                  key={getKey(item)}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm text-gray-200 transition-colors hover:bg-white/5"
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
          <p className="mt-1 text-[10px] text-red-400">
            {suggestions.length === 0 && hasQuery ? emptyMessage : 'יש לבחור מהרשימה'}
          </p>
        )}
      </div>
    </div>
  )
}
