import { useState, useMemo, FormEvent } from 'react'
import { HelpCircle, Printer, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ModalActions } from '@/components/ui/ModalActions'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { isPlanLimitError } from '@/lib/plans'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import {
  createTriviaQuestion,
  draftFromQuestion,
  emptyTriviaDraft,
  updateTriviaQuestion,
  validateTriviaDraft,
  type SavedQuestion,
  type TriviaDraft,
} from '@/lib/tasks/triviaQuestions'
import { isMissingTriviaTablesError, MISSING_TRIVIA_TABLES_MESSAGE } from '@/lib/tasks/triviaTasksFlag'
import type { Action, ActionOption } from '@/types'

interface TriviaComposerModalProps {
  eventId: string
  isOpen: boolean
  onClose: () => void
  onSaved: (saved: SavedQuestion) => void
  onPlanLimit?: () => void
  /** Names of the other tasks, so two of them cannot end up identical. */
  siblingNames?: string[]
  /** Present when editing rather than creating. */
  existing?: { action: Action; options: ActionOption[] }
}

/**
 * Writing a trivia question, and showing what it will become.
 *
 * A dialog rather than an inline row - the fast one-line add stays exactly as it
 * was for ordinary tasks, and this is where the customer goes when they want the
 * other thing. Three parts do the explaining, and none of them is decoration:
 *
 *   1. the strip at the top, which describes what will physically happen at the
 *      event rather than what the software will store;
 *   2. the answers, each with the radio that marks the one that scores;
 *   3. the preview, which is the three cards as they will print - including the
 *      fact that the correct one is not marked on them.
 *
 * Nothing here is reachable without the `trivia_tasks` flag.
 */
export function TriviaComposerModal({
  eventId,
  isOpen,
  onClose,
  onSaved,
  onPlanLimit,
  siblingNames = [],
  existing,
}: TriviaComposerModalProps) {
  const isEdit = !!existing
  const [draft, setDraft] = useState<TriviaDraft>(() =>
    existing ? draftFromQuestion(existing.action, existing.options) : emptyTriviaDraft(),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)

  // Editing a question must not collide with its own name.
  const otherNames = useMemo(
    () => siblingNames.filter((n) => n !== existing?.action.name),
    [siblingNames, existing],
  )

  const validation = validateTriviaDraft(draft, otherNames)
  const showError = touched ? validation : null

  function patch(next: Partial<TriviaDraft>) {
    setDraft((prev) => ({ ...prev, ...next }))
  }

  function setAnswer(index: number, value: string) {
    setDraft((prev) => ({
      ...prev,
      answers: prev.answers.map((a, i) => (i === index ? value : a)),
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (validation) return

    setSaving(true)
    setError('')
    try {
      const saved = existing
        ? await updateTriviaQuestion(existing.action, existing.options, draft)
        : await createTriviaQuestion(eventId, draft)
      onSaved(saved)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'משהו השתבש.'
      if (isPlanLimitError(message) && onPlanLimit) {
        onClose()
        onPlanLimit()
        return
      }
      setError(isMissingTriviaTablesError(message) ? MISSING_TRIVIA_TABLES_MESSAGE : message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'עריכת שאלת טריוויה' : 'שאלת טריוויה'}
      dialogClassName="max-w-xl"
      footer={
        <ModalActions>
          <Button type="submit" form="trivia-composer" loading={saving}>
            {isEdit ? 'שמירת שינויים' : 'שמירת השאלה'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </ModalActions>
      }
    >
      <form id="trivia-composer" onSubmit={handleSubmit} className="space-y-5">
        {error && <ErrorAlert message={error} />}

        {/* What will actually happen at the event, in three sentences. */}
        <div className="flex gap-3 rounded-xl border border-border bg-surface-elevated px-3 py-2.5">
          <Printer size={18} className="mt-0.5 shrink-0 text-muted" strokeWidth={1.75} />
          <p className="text-xs leading-relaxed text-muted">
            יודפסו <strong className="font-bold text-foreground">3 כרטיסים</strong> - כרטיס לכל
            תשובה. המשתתף סורק את הכרטיס שנראה לו נכון. רק התשובה הנכונה מזכה בנקודות, ולכל משתתף
            יש ניסיון אחד.
          </p>
        </div>

        <Input
          label="השאלה"
          placeholder="לדוגמה: באיזו שנה הוקם היישוב?"
          value={draft.question}
          onChange={(e) => patch({ question: e.target.value })}
          error={showError?.field === 'question' ? showError.message : undefined}
          autoFocus
        />

        <fieldset>
          <legend className={cn('mb-1 block text-sm font-medium', theme.label)}>
            התשובות · סמנו את הנכונה
          </legend>

          <div className="space-y-2">
            {draft.answers.map((answer, i) => {
              const isCorrect = draft.correctIndex === i
              return (
                <label
                  key={i}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition-colors',
                    isCorrect
                      ? 'border-primary/60 bg-primary/[0.06]'
                      : cn(theme.inputBorder, 'bg-surface-elevated'),
                  )}
                >
                  <input
                    type="radio"
                    name="trivia-correct"
                    checked={isCorrect}
                    onChange={() => patch({ correctIndex: i })}
                    aria-label={`התשובה הנכונה היא תשובה ${i + 1}`}
                    className={cn('h-4 w-4 shrink-0', theme.checkbox)}
                  />
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(i, e.target.value)}
                    placeholder={`תשובה ${i + 1}`}
                    aria-label={`תשובה ${i + 1}`}
                    className={cn(
                      'w-full min-w-0 border-0 bg-transparent p-0 text-sm outline-none',
                      theme.text,
                      theme.inputPlaceholder,
                    )}
                  />
                  {isCorrect && (
                    <span className="shrink-0 text-[11px] font-bold text-primary">נכונה</span>
                  )}
                </label>
              )
            })}
          </div>

          {(showError?.field === 'answers' || showError?.field === 'correct') && (
            <p role="alert" className="mt-1.5 text-sm text-danger-text">
              {showError.message}
            </p>
          )}
        </fieldset>

        <div className="flex flex-wrap items-end gap-4">
          <div className="w-32">
            <Input
              label="נקודות"
              type="number"
              value={Number.isFinite(draft.points) ? draft.points.toString() : ''}
              onChange={(e) => patch({ points: parseInt(e.target.value, 10) })}
            />
          </div>
          {/* Not a field: 0 is the rule, and leaving it unsaid would make it a
              guess. See §14 of the spec for why it is not configurable yet. */}
          <p className="pb-2.5 text-xs text-muted">תשובה שגויה: 0 נקודות</p>
        </div>

        <TriviaCardsPreview draft={draft} />
      </form>
    </Modal>
  )
}

/**
 * The three cards as the printer will produce them: the answer big, the question
 * small beneath it, no points, and nothing at all marking the right one.
 *
 * The note beside them says that last part out loud, because it is the thing an
 * organiser is most likely to worry about and least likely to notice is handled.
 */
function TriviaCardsPreview({ draft }: { draft: TriviaDraft }) {
  const question = draft.question.trim() || 'השאלה שלכם'

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold text-muted">כך זה יודפס</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-wrap gap-2">
          {draft.answers.map((answer, i) => (
            <div
              key={i}
              className="flex min-w-0 flex-1 basis-24 flex-col gap-1 rounded-lg border border-border bg-surface p-2"
            >
              <div className="flex items-center gap-1 text-muted/60" aria-hidden>
                <span className="grid h-6 w-6 place-items-center rounded bg-surface-elevated text-[8px] font-bold">
                  QR
                </span>
                <HelpCircle size={11} strokeWidth={2} />
              </div>
              <p className="truncate text-xs font-bold text-foreground">
                {answer.trim() || `תשובה ${i + 1}`}
              </p>
              <p className="truncate text-[9px] text-muted">{question}</p>
            </div>
          ))}
        </div>

        <p className="w-28 shrink-0 text-[10px] leading-relaxed text-muted">
          הכרטיסים יודפסו בסדר אקראי, בלי שום סימון על הנכון.
        </p>
      </div>
    </div>
  )
}

/** The `✓` used wherever a saved question lists its answers to the organiser. */
export function CorrectAnswerMark() {
  return <Check size={11} strokeWidth={3} className="shrink-0" aria-label="התשובה הנכונה" />
}
