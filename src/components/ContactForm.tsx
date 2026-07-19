import { useState, useEffect, useId, FormEvent } from 'react'
import { CheckCircle, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { trackGenerateLead, trackAppError } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import {
  type ContactIntent,
  type ContactSource,
  limitTypeForIntent,
  buildContextNotes,
} from '@/lib/contact'

const CONTACT_EMAIL = 'ourgamify@gmail.com'
const CONTACT_PHONE = '0556738544'
const CONTACT_GMAIL_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${CONTACT_EMAIL}`

export interface ContactFormProps {
  intent?: ContactIntent
  /** Stored on the request row for admin routing / labeling. Overrides intent default when set. */
  limitType?: string
  /** GA `plan_name` / lead name — must not include PII. */
  analyticsPlanName?: string
  eventId?: string | null
  eventName?: string | null
  /** Internal entry-point marker for analytics only (not shown in UI). */
  source?: ContactSource
  /** Page / surface tag appended to notes (not shown in UI). */
  pageSource?: string | null
  /** Optional selected-plan chip (pricing flow). */
  selectedOptionLabel?: string | null
  /** When true, hide the in-form heading (e.g. title already shown on Modal). */
  hideHeading?: boolean
  heading?: string
  subheading?: string
  submitLabel?: string
  /** When event already has details, use the compact plan-lead field set. */
  eventPrefill?: {
    name?: string | null
    participantCount?: number | null
  } | null
  onSubmitted?: () => void
}

function defaultHeading(intent: ContactIntent, hasEvent: boolean): string {
  switch (intent) {
    case 'contact':
      return 'יש לכם שאלה? אנחנו כאן 😊'
    case 'plan_lead':
      return hasEvent ? 'מעולה! נשאר רק לדבר 😊' : 'מעולה, בואו נכיר את האירוע שלכם 🎉'
    case 'organization_lead':
      return 'בואו נתאים את Gamify לארגון שלכם'
    case 'plan_independent':
      return 'מעולה — נחזור אליכם להשלמת ההפעלה'
    case 'plan_offline':
      return 'מעולה! נשלח לכם את המשחק שרץ בלי אינטרנט 📴'
  }
}

function defaultSubmitLabel(intent: ContactIntent, hasEvent: boolean): string {
  switch (intent) {
    case 'contact':
      return 'שלחו ונחזור אליכם'
    case 'plan_lead':
      return hasEvent ? 'חזרו אליי' : 'בואו נדבר'
    case 'organization_lead':
      return 'דברו איתנו'
    case 'plan_independent':
      return 'שלחו ונחזור להפעלה'
    case 'plan_offline':
      return 'שלחו ונחזור אליכם'
  }
}

export function ContactForm({
  intent = 'contact',
  limitType,
  analyticsPlanName,
  eventId = null,
  eventName = null,
  source,
  pageSource = null,
  selectedOptionLabel = null,
  hideHeading = false,
  heading,
  subheading,
  submitLabel,
  eventPrefill = null,
  onSubmitted,
}: ContactFormProps) {
  const { user, profile } = useAuth()
  const hasEvent = Boolean(eventId)
  const compactPlanLead = intent === 'plan_lead' && hasEvent

  // Ids so each visible label is programmatically tied to its control —
  // they read as labels only when associated (WCAG 1.3.1 / 4.1.2).
  const fid = useId()
  const [fullName, setFullName] = useState(profile?.display_name || '')
  const [email, setEmail] = useState(profile?.email || user?.email || '')
  const [phone, setPhone] = useState('')
  const [eventType, setEventType] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [dateUndecided, setDateUndecided] = useState(false)
  const [participantCount, setParticipantCount] = useState(
    eventPrefill?.participantCount != null ? String(eventPrefill.participantCount) : '',
  )
  const [organizationName, setOrganizationName] = useState('')
  const [callbackPreference, setCallbackPreference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.display_name) setFullName(profile.display_name)
    if (profile?.email || user?.email) setEmail(profile?.email || user?.email || '')
  }, [profile, user])

  const resolvedLimitType = limitType ?? limitTypeForIntent(intent, source)
  const resolvedAnalyticsName = analyticsPlanName ?? source ?? resolvedLimitType
  const resolvedHeading = heading ?? defaultHeading(intent, hasEvent)
  const resolvedSubmit = submitLabel ?? defaultSubmitLabel(intent, hasEvent)
  // Same contact fields as the general form — including pricing / plan leads.
  const showEmailField = true
  const showDirectContact = true
  const emailRequired = false

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedName) { setError('שם הוא שדה חובה'); return }
    if (!trimmedPhone) { setError('מספר טלפון הוא שדה חובה'); return }
    if (showEmailField && emailRequired && !trimmedEmail) {
      setError('אימייל הוא שדה חובה')
      return
    }

    if (intent === 'organization_lead' && !organizationName.trim()) {
      setError('שם הארגון הוא שדה חובה')
      return
    }

    setSubmitting(true)

    const noteParts: string[] = []
    if (intent === 'organization_lead' && organizationName.trim()) {
      noteParts.push(`שם הארגון: ${organizationName.trim()}`)
    }
    if (!compactPlanLead && eventType.trim()) {
      noteParts.push(`סוג אירוע / פעילות: ${eventType.trim()}`)
    }
    if (!compactPlanLead) {
      if (dateUndecided) noteParts.push('תאריך האירוע: עדיין לא נקבע')
      else if (eventDate.trim()) noteParts.push(`תאריך האירוע: ${eventDate.trim()}`)
    }
    if (!compactPlanLead && participantCount.trim()) {
      noteParts.push(`מספר משתתפים משוער: ${participantCount.trim()}`)
    }
    if (compactPlanLead && callbackPreference.trim()) {
      noteParts.push(`מתי נוח לחזור: ${callbackPreference.trim()}`)
    }
    if (notes.trim()) {
      const label =
        intent === 'contact'
          ? 'איך אפשר לעזור'
          : compactPlanLead
            ? 'משהו שחשוב שנדע'
            : 'מידע נוסף'
      noteParts.push(`${label}: ${notes.trim()}`)
    }

    const contextNotes = buildContextNotes({
      pageSource,
      eventName: eventName || eventPrefill?.name || null,
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      mode: intent,
    })
    if (contextNotes) noteParts.push(`---\n${contextNotes}`)

    const combinedNotes = noteParts.join('\n') || null

    // Prefer known email when the field is hidden; empty string satisfies NOT NULL.
    const emailToStore =
      trimmedEmail ||
      profile?.email ||
      user?.email ||
      ''

    const requestId = crypto.randomUUID()

    const { error: insertError } = await supabase
      .from('contact_upgrade_requests')
      .insert({
        id: requestId,
        user_id: user?.id ?? null,
        full_name: trimmedName,
        email: emailToStore,
        phone: trimmedPhone,
        notes: combinedNotes,
        limit_type: resolvedLimitType,
        event_id: eventId ?? null,
      })

    if (insertError) {
      trackAppError('pricing', 'submit_failed')
      setError('שגיאה בשליחת הבקשה. נסו שנית.')
      setSubmitting(false)
      return
    }

    supabase.functions
      .invoke('notify-contact-request', { body: { requestId } })
      .catch((err) => console.error('Failed to notify admins', err))

    trackGenerateLead(resolvedAnalyticsName, Boolean(eventId), source ?? intent)
    setSubmitting(false)
    setSubmitted(true)
    onSubmitted?.()
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-success bg-surface-elevated">
          <CheckCircle size={26} className="text-success-text" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">הפנייה נשלחה בהצלחה</p>
          <p className="mt-1 text-sm text-muted">ניצור אתכם קשר בהקדם.</p>
        </div>
      </div>
    )
  }

  const notesLabel =
    intent === 'contact'
      ? 'איך אפשר לעזור?'
      : compactPlanLead
        ? 'משהו שחשוב שנדע'
        : 'מידע נוסף'
  const notesOptional = intent !== 'contact'

  return (
    <>
      {!hideHeading && (
        <>
          <h2 className="mb-1 text-lg font-bold text-foreground">{resolvedHeading}</h2>
          {subheading && <p className="mb-5 text-sm text-muted">{subheading}</p>}
          {!subheading && intent === 'contact' && (
            <p className="mb-5 text-sm text-muted">כתבו לנו ונחזור אליכם בהקדם.</p>
          )}
          {!subheading && intent !== 'contact' && <div className="mb-5" />}
        </>
      )}

      {selectedOptionLabel && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-primary bg-surface-elevated px-4 py-2.5">
          <span className="text-xs font-semibold text-primary-text">האפשרות שבחרתם</span>
          <span className="text-xs font-medium text-foreground">{selectedOptionLabel}</span>
        </div>
      )}

      {hasEvent && eventName && intent !== 'contact' && (
        <p className="mb-4 text-sm text-muted">
          אירוע: <span className="font-medium text-foreground">{eventName}</span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div
          className={cn(
            'grid grid-cols-1 gap-3',
            showEmailField
              ? 'sm:grid-cols-[minmax(0,1.1fr)_minmax(7rem,0.75fr)_minmax(0,1.35fr)]'
              : 'sm:grid-cols-2',
          )}
        >
          <div className="min-w-0">
            <label htmlFor={`${fid}-name`} className="mb-1 block text-xs font-semibold text-muted">שם *</label>
            <input
              id={`${fid}-name`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="ישראל ישראלי"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor={`${fid}-phone`} className="mb-1 block text-xs font-semibold text-muted">טלפון *</label>
            <input
              type="tel"
              id={`${fid}-phone`}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-1234567"
              dir="ltr"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
            />
          </div>
          {showEmailField && (
            <div className="min-w-0">
              <label htmlFor={`${fid}-email`} className="mb-1 block text-xs font-semibold text-muted">
                אימייל {emailRequired ? '*' : '(אופציונלי)'}
              </label>
              <input
                type="email"
                id={`${fid}-email`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
          )}
        </div>

        {intent === 'organization_lead' && (
          <div>
            <label htmlFor={`${fid}-org`} className="mb-1 block text-xs font-semibold text-muted">שם הארגון *</label>
            <input
              id={`${fid}-org`}
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="שם בית הספר / החברה / הקהילה"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
            />
          </div>
        )}

        {!compactPlanLead && (intent === 'plan_lead' || intent === 'organization_lead') && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(7.5rem,0.85fr)]">
            <div className="min-w-0">
              <label htmlFor={`${fid}-eventType`} className="mb-1 block text-xs font-semibold text-muted">
                {intent === 'organization_lead' ? 'סוג האירוע / הפעילות' : 'סוג אירוע'}
              </label>
              <input
                id={`${fid}-eventType`}
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="לדוגמה: נופש משפחתי, יום גיבוש, קייטנה"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor={`${fid}-count`} className="mb-1 block text-xs font-semibold text-muted">מספר משתתפים משוער</label>
              <input
                type="number"
                min="1"
                id={`${fid}-count`}
              value={participantCount}
                onChange={(e) => setParticipantCount(e.target.value)}
                placeholder="50"
                dir="ltr"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
          </div>
        )}

        {!compactPlanLead && intent === 'plan_lead' && (
          <div>
            <label htmlFor={`${fid}-eventDate`} className="mb-1 block text-xs font-semibold text-muted">תאריך אירוע</label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                id={`${fid}-eventDate`}
                value={eventDate}
                disabled={dateUndecided}
                onChange={(e) => setEventDate(e.target.value)}
                dir="ltr"
                className="w-auto max-w-full shrink-0 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary disabled:opacity-50"
              />
              <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={dateUndecided}
                  onChange={(e) => {
                    setDateUndecided(e.target.checked)
                    if (e.target.checked) setEventDate('')
                  }}
                />
                עדיין לא נקבע
              </label>
            </div>
          </div>
        )}

        {compactPlanLead && (
          <div>
            <label htmlFor={`${fid}-callback`} className="mb-1 block text-xs font-semibold text-muted">מתי נוח לחזור אליכם</label>
            <input
              id={`${fid}-callback`}
              value={callbackPreference}
              onChange={(e) => setCallbackPreference(e.target.value)}
              placeholder="לדוגמה: בוקר, אחה״צ, באמצע השבוע"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
            />
          </div>
        )}

        <div>
          <label htmlFor={`${fid}-notes`} className="mb-1 block text-xs font-semibold text-muted">
            {notesLabel}
            {notesOptional ? ' (אופציונלי)' : ''}
          </label>
          <textarea
            id={`${fid}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={intent === 'contact' ? 'ספרו לנו במה נוכל לעזור' : 'פרטים נוספים'}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
          />
        </div>

        {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}

        <Button
          type="submit"
          variant="gradient"
          size="lg"
          loading={submitting}
          className="w-full font-semibold"
        >
          {resolvedSubmit}
        </Button>

        {showDirectContact && (
          <div className="pt-2 text-center">
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm leading-relaxed text-muted">
              <span className="font-semibold text-foreground">מעדיפים לדבר איתנו?</span>
              <a
                href={CONTACT_GMAIL_URL}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="inline-flex items-center gap-1 font-semibold text-primary-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                <Mail size={17} strokeWidth={2.25} aria-hidden="true" />
                {CONTACT_EMAIL}
              </a>
              <span className="text-border" aria-hidden="true">|</span>
              <a
                href={`tel:${CONTACT_PHONE}`}
                dir="ltr"
                className="inline-flex items-center gap-1 font-semibold text-primary-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                <Phone size={17} strokeWidth={2.25} aria-hidden="true" />
                {CONTACT_PHONE}
              </a>
            </p>
          </div>
        )}
      </form>
    </>
  )
}
