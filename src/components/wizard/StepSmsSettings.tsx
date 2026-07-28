import { useRef, useState } from 'react'
import { MessageSquare, RotateCcw } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { ScrollContainer } from '@/components/ui/ScrollContainer'
import { Alert } from '@/components/ui/Alert'
import { ChipButton } from '@/components/ui/ChipButton'
import { Textarea } from '@/components/ui/Textarea'
import { PanelCard } from '@/components/ui/PanelCard'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_SMS_TEMPLATE,
  SMS_VARIABLES,
  previewSmsTemplate,
  smsSegments,
  smsTemplateErrorLabel,
  unknownSmsVariables,
} from '@/lib/smsTemplate'
import {
  MISSING_SMS_TEMPLATE_COLUMN_MESSAGE,
  isMissingSmsTemplateColumnError,
} from '@/lib/smsNotifications'
import type { Event } from '@/types'

/**
 * The wizard step for games that were sold SMS.
 *
 * One decision lives here: what the text a participant gets after a scan says.
 * The rest of the feature needs no setting - who gets it is "whoever has a phone
 * number", and when is "every scan" - so the step is a message editor and its
 * preview, and nothing else.
 *
 * Hidden entirely without the `sms_notifications` flag, so most games never see
 * it and never learn that it exists (EventWizard, hiddenWizardSteps).
 *
 * Nothing here is required. An operator who walks straight through sends the
 * default text, which is a whole sentence that says the right things - so the
 * step never blocks starting a game, and its CTA is a plain המשך.
 */

interface StepSmsSettingsProps {
  event: Event
  onEventUpdated: (event: Event) => void
  onNext: () => void
  onBack: () => void
}

export function StepSmsSettings({ event, onEventUpdated, onNext, onBack }: StepSmsSettingsProps) {
  const [template, setTemplate] = useState(event.sms_template || DEFAULT_SMS_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const error = smsTemplateErrorLabel(template)
  const unknown = unknownSmsVariables(template)
  const preview = previewSmsTemplate(template)
  const segments = smsSegments(preview)
  const isDefault = template.trim() === DEFAULT_SMS_TEMPLATE

  /**
   * Puts a variable where the operator's cursor is, not at the end - they click
   * a chip in the middle of writing a sentence, and jumping to the end would
   * make the chips useless for exactly the case they exist for.
   */
  function insertVariable(token: string) {
    const field = textareaRef.current
    const snippet = `{{${token}}}`

    if (!field) {
      setTemplate((prev) => prev + snippet)
      return
    }

    const start = field.selectionStart ?? template.length
    const end = field.selectionEnd ?? start
    setTemplate(template.slice(0, start) + snippet + template.slice(end))

    // After React writes the new value, put the caret after what was inserted
    // so the operator can keep typing the rest of the sentence.
    requestAnimationFrame(() => {
      field.focus()
      const caret = start + snippet.length
      field.setSelectionRange(caret, caret)
    })
  }

  async function handleNext() {
    if (error) return

    const next = template.trim()
    if (next === (event.sms_template ?? '')) {
      onNext()
      return
    }

    setSaving(true)
    setSaveError(null)

    const { error: writeError } = await supabase
      .from('events')
      .update({ sms_template: next })
      .eq('id', event.id)

    setSaving(false)

    if (writeError) {
      // Told apart from any other failure: the operator sold SMS, wrote a
      // message and cannot save it, which reads as a broken feature rather than
      // as one migration nobody applied.
      setSaveError(
        isMissingSmsTemplateColumnError(writeError.message)
          ? MISSING_SMS_TEMPLATE_COLUMN_MESSAGE
          : 'שמירת ההודעה נכשלה. נסו שוב.',
      )
      return
    }

    onEventUpdated({ ...event, sms_template: next })
    onNext()
  }

  return (
    <WizardStepWrapper
      title="מה נשלח למשתתפים?"
      subtitle="בכל סריקה נשלח SMS למשתתף עם הניקוד שצבר. כאן כותבים את נוסח ההודעה - הוסיפו משתנים והם יוחלפו בפרטים האמיתיים של כל סריקה."
      currentStep={6}
      canAdvance={!error && !saving}
      onNext={handleNext}
      onBack={onBack}
    >
      <ScrollContainer className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-2">
          {saveError && <Alert variant="error" message={saveError} />}

          <div>
            <Textarea
              ref={textareaRef}
              label="נוסח ההודעה"
              rows={4}
              dir="rtl"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              error={error || undefined}
              className="resize-none leading-relaxed"
            />

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted">הוסיפו משתנה:</span>
              {SMS_VARIABLES.map((variable) => (
                <ChipButton
                  key={variable.token}
                  onClick={() => insertVariable(variable.token)}
                  title={`{{${variable.token}}}`}
                >
                  {variable.label}
                </ChipButton>
              ))}
              {!isDefault && (
                <button
                  type="button"
                  onClick={() => setTemplate(DEFAULT_SMS_TEMPLATE)}
                  className="mr-auto inline-flex items-center gap-1 px-1 py-1 text-[11px] font-medium text-muted transition-colors hover:text-foreground"
                >
                  <RotateCcw size={12} strokeWidth={2.5} />
                  חזרה לנוסח ברירת המחדל
                </button>
              )}
            </div>
          </div>

          {unknown.length > 0 && (
            <Alert variant="warning">
              {`לא מזוהים כמשתנים ולכן יישלחו כמו שהם: ${unknown.map((name) => `{{${name}}}`).join(', ')}`}
            </Alert>
          )}

          {/* The message as a participant will actually see it - filled in with
              sample details, so the operator reads a sentence rather than the
              braces they just typed. */}
          <PanelCard size="sm" className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
              <MessageSquare size={13} strokeWidth={2.5} />
              כך זה ייראה אצל המשתתף
            </div>
            <p className="whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
              {preview}
            </p>
            <div className="text-[11px] text-muted">
              {preview.length} תווים
              {segments > 1 && ` · נשלח כ-${segments} הודעות`}
            </div>
          </PanelCard>

          <p className="text-[11px] leading-relaxed text-muted">
            ההודעה נשלחת רק למשתתפים שיש להם מספר טלפון. אפשר להוסיף מספרים בשלב «מי משתתף?»
            או בקובץ הייבוא.
          </p>
        </div>
      </ScrollContainer>
    </WizardStepWrapper>
  )
}
