import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CheckSquare, HelpCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InlineAddField } from '@/components/ui/InlineAddField'
import { InlineAddPointsTrailing } from '@/components/ui/InlineAddPointsTrailing'
import { InlineAddAction } from './InlineAddAction'
import type { SecretOwnerOption } from './SecretOwnerPicker'
import type { Action } from '@/types'

export type AddTaskKind = 'standard' | 'trivia' | 'secret'

interface KindOption {
  value: AddTaskKind
  label: string
  /** One line: enough for someone who never heard of it to know if they want it. */
  hint: string
  icon: LucideIcon | string
}

const KIND_OPTIONS: Record<AddTaskKind, KindOption> = {
  standard: { value: 'standard', label: 'משימה רגילה', hint: 'סורקים את הכרטיס - מקבלים נקודות', icon: CheckSquare },
  trivia: { value: 'trivia', label: 'שאלת טריוויה', hint: '3 כרטיסי תשובה, רק הנכונה מזכה בנקודות', icon: HelpCircle },
  secret: {
    value: 'secret',
    label: 'משימה סודית',
    hint: 'של משתתף/ת אחד/ת, פעם אחת. מסך הסריקה מראה רק של מי היא, וחושף אותה אחרי הסריקה',
    icon: '🤫',
  },
}

interface AddTaskPanelProps {
  eventId: string
  onAdded: (action: Action) => void
  onPlanLimit?: () => void
  existingNames: string[]
  onFeedback: (message: string, variant: 'success' | 'error') => void
  nameInputRef?: React.RefObject<HTMLInputElement | null>
  triviaEnabled: boolean
  /** The roster - and the secret kind's switch: undefined hides it. */
  secretOwners?: SecretOwnerOption[]
  /** Opens the trivia composer with the question and points already typed here. */
  onStartTrivia: (question: string, points: number) => void
}

/**
 * Adding a task: pick what kind first, then fill in the one field that kind
 * needs. With no kind but the ordinary one on this game, there is nothing to
 * pick and the field stands alone, exactly as before.
 */
export function AddTaskPanel({
  eventId,
  onAdded,
  onPlanLimit,
  existingNames,
  onFeedback,
  nameInputRef,
  triviaEnabled,
  secretOwners,
  onStartTrivia,
}: AddTaskPanelProps) {
  const kinds: AddTaskKind[] = [
    'standard',
    ...(triviaEnabled ? (['trivia'] as const) : []),
    ...(secretOwners ? (['secret'] as const) : []),
  ]
  const [kind, setKind] = useState<AddTaskKind>('standard')
  const [question, setQuestion] = useState('')
  // A question is worth more than a scan by default - the composer's own 20.
  const [triviaPoints, setTriviaPoints] = useState('20')
  const triviaPointsRef = useRef<HTMLInputElement>(null)
  const fallbackRef = useRef<HTMLInputElement>(null)
  const inputRef = nameInputRef ?? fallbackRef
  const switchedRef = useRef(false)

  // A kind the flags no longer offer falls back to the ordinary one.
  const active = kinds.includes(kind) ? kind : 'standard'

  useEffect(() => {
    if (!switchedRef.current) return
    inputRef.current?.focus()
  }, [active, inputRef])

  function choose(next: AddTaskKind) {
    switchedRef.current = true
    setKind(next)
  }

  function startTrivia() {
    const text = question.trim()
    if (!text) return
    const points = parseInt(triviaPoints, 10)
    if (isNaN(points)) {
      onFeedback('יש לבחור מספר נקודות', 'error')
      return
    }
    onStartTrivia(text, points)
    setQuestion('')
    setTriviaPoints('20')
  }

  // Enter walks to the points, then on - the same as the ordinary field.
  function handleQuestionKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      triviaPointsRef.current?.focus()
      triviaPointsRef.current?.select()
    }
  }

  function handleTriviaPointsKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      startTrivia()
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {kinds.length > 1 && (
        <>
          <div
            role="radiogroup"
            aria-label="סוג הפעילות"
            className="flex gap-1 rounded-xl border border-border bg-surface-elevated p-1"
          >
            {kinds.map((value) => {
              const option = KIND_OPTIONS[value]
              const selected = value === active
              const Icon = option.icon
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(value)}
                  className={cn(
                    'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    selected
                      ? 'bg-surface text-foreground shadow-card'
                      : 'text-muted hover:bg-surface/60 hover:text-foreground',
                  )}
                >
                  {typeof Icon === 'string'
                    ? <span aria-hidden className="text-sm leading-none">{Icon}</span>
                    : <Icon size={14} strokeWidth={2} className="shrink-0" aria-hidden />}
                  <span className="truncate">{option.label}</span>
                </button>
              )
            })}
          </div>
          <p className="px-1 text-[11px] leading-snug text-muted">{KIND_OPTIONS[active].hint}</p>
        </>
      )}

      {active === 'trivia' ? (
        <InlineAddField
          value={question}
          onChange={setQuestion}
          onKeyDown={handleQuestionKey}
          placeholder="השאלה - לדוגמה: מה אוכלים בחנוכה?"
          onSubmit={startTrivia}
          submitLabel="המשך לתשובות"
          inputRef={inputRef}
          trailing={
            <InlineAddPointsTrailing
              value={triviaPoints}
              onChange={setTriviaPoints}
              onKeyDown={handleTriviaPointsKey}
              inputRef={triviaPointsRef}
            />
          }
        />
      ) : (
        <InlineAddAction
          // A fresh field per kind: a half-typed ordinary task must not turn
          // into a secret one by switching tabs.
          key={active}
          eventId={eventId}
          onAdded={onAdded}
          onPlanLimit={onPlanLimit}
          existingNames={existingNames}
          onFeedback={onFeedback}
          nameInputRef={inputRef}
          secretOwners={active === 'secret' ? secretOwners : undefined}
        />
      )}
    </div>
  )
}
