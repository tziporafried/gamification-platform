/**
 * The message a game sends after a scan, as its owner wrote it.
 *
 * Nothing here sends anything - that is src/lib/scanSms.ts. This file is the
 * template itself: which variables exist, how one is filled in, and what a
 * game that never touched the wizard step sends instead. It touches no network
 * and no database, which is what lets smsTemplate.test.ts assert the exact
 * sentence a participant receives.
 *
 * ── Why the customer writes it ──────────────────────────────────────────────
 * A school, a company retreat and a bar mitzvah do not address people the same
 * way, and the text arrives from the customer's own game with the customer's own
 * name on it. So the wording is theirs, and the wizard step (StepSmsSettings)
 * is where they set it - per game, stored on `events.sms_template`, empty
 * meaning DEFAULT_SMS_TEMPLATE below.
 *
 * ── The variables ───────────────────────────────────────────────────────────
 * Written in Hebrew, because the person typing the sentence around them is
 * typing in Hebrew and `{{שם}}` in the middle of a Hebrew line is readable in a
 * way `{{name}}` is not. The English names are kept as aliases anyway: they cost
 * one line each, and a template pasted in from somewhere else keeps working.
 *
 * A token nobody recognises is left standing in the message rather than erased.
 * `{{נקודות}}` where `{{ניקוד}}` was meant is a typo the operator can see and
 * fix - the step names it explicitly - where silently dropping it would send a
 * sentence with a hole in it to every participant and tell nobody.
 */

/** One variable the operator can put in the message. */
export interface SmsVariable {
  /** The canonical name, written inside `{{ }}`. */
  token: string
  /** What it means, for the chip in the wizard. */
  label: string
  /** Stands in for the real value in the step's live preview. */
  sample: string
  /** Also accepted, so a template does not break on the obvious other spelling. */
  aliases: readonly string[]
}

/** The values one scan supplies. */
export interface SmsValues {
  /** Participant name. */
  name: string
  /** The task that was scanned. */
  task: string
  /** Points this scan was worth. */
  points: number
  /** Points the participant has after it. */
  total: number
  /** The game's own name. */
  event: string
}

export const SMS_VARIABLES: readonly SmsVariable[] = [
  { token: 'שם', label: 'שם המשתתף', sample: 'דנה', aliases: ['name', 'participant'] },
  { token: 'משימה', label: 'שם המשימה', sample: 'ריצת בוקר', aliases: ['task', 'action'] },
  { token: 'ניקוד', label: 'הניקוד שהתקבל', sample: '10', aliases: ['points', 'score'] },
  { token: 'סהכ', label: 'סה"כ נקודות', sample: '120', aliases: ['סה"כ', 'סה״כ', 'total'] },
  { token: 'פעילות', label: 'שם הפעילות', sample: 'ספורטתון קיץ', aliases: ['event', 'game'] },
]

/**
 * What a game sends until somebody changes it.
 *
 * Deliberately the plainest sentence that carries the three facts the scan is
 * about, in the order they are read: what just happened, what it was for, where
 * they now stand. `נק'` rather than `נקודות` for a reason worth keeping in mind
 * when editing this line - the substitution is a bare number, so a message
 * written around `נקודות` says "1 נקודות" to whoever scores a single point.
 */
export const DEFAULT_SMS_TEMPLATE =
  'היי {{שם}}! קיבלת {{ניקוד}} נק\' על "{{משימה}}". סה"כ יש לך {{סהכ}} נק\'.'

/** A template longer than this is refused - see validateSmsTemplate. */
export const SMS_TEMPLATE_MAX_CHARS = 480

/**
 * Israeli SMS is billed by segment, and Hebrew forces UCS-2: 70 characters for
 * one segment, 67 each once a message needs more than one. A name and a task
 * title are written by the customer, so a long one can push a message that fits
 * in the editor past a segment once it is filled in - which costs twice, not a
 * lost message. Shown in the step rather than enforced: cutting somebody's task
 * title mid-word to save an agora reads as a bug.
 */
export const SMS_SEGMENT_CHARS = 70

/** Segments this body will be billed as. */
export function smsSegments(body: string): number {
  if (body.length <= SMS_SEGMENT_CHARS) return 1
  return Math.ceil(body.length / 67)
}

/** `{{ שם }}`, with whatever spacing somebody typed inside the braces. */
const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g

/** Every spelling that resolves to a variable, mapped to its canonical token. */
const BY_NAME = new Map<string, string>(
  SMS_VARIABLES.flatMap((v) => [v.token, ...v.aliases].map((name) => [name.toLowerCase(), v.token])),
)

function resolve(name: string): string | null {
  return BY_NAME.get(name.toLowerCase()) ?? null
}

function valueFor(token: string, values: SmsValues): string {
  switch (token) {
    case 'שם':
      return values.name
    case 'משימה':
      return values.task
    case 'ניקוד':
      return String(values.points)
    case 'סהכ':
      return String(values.total)
    case 'פעילות':
      return values.event
    default:
      return ''
  }
}

/**
 * Fills one message in. Never throws: this runs on the way out of a scan, where
 * a template somebody mistyped must still produce a message.
 */
export function renderSmsTemplate(template: string | null | undefined, values: SmsValues): string {
  const source = (template ?? '').trim() || DEFAULT_SMS_TEMPLATE
  return source.replace(TOKEN, (whole, name: string) => {
    const token = resolve(name)
    return token ? valueFor(token, values) : whole
  })
}

/** The sample message the wizard step shows while the operator types. */
export function previewSmsTemplate(template: string | null | undefined): string {
  const samples = Object.fromEntries(SMS_VARIABLES.map((v) => [v.token, v.sample]))
  return renderSmsTemplate(template, {
    name: samples['שם'],
    task: samples['משימה'],
    points: Number(samples['ניקוד']),
    total: Number(samples['סהכ']),
    event: samples['פעילות'],
  })
}

/** Canonical tokens this template actually uses, in the order they appear. */
export function usedSmsVariables(template: string): string[] {
  const used: string[] = []
  for (const [, name] of template.matchAll(TOKEN)) {
    const token = resolve(name)
    if (token && !used.includes(token)) used.push(token)
  }
  return used
}

/**
 * `{{ }}` names that resolve to nothing - almost always a typo, and named in
 * the step so it is fixed before the game starts rather than after.
 */
export function unknownSmsVariables(template: string): string[] {
  const unknown: string[] = []
  for (const [, name] of template.matchAll(TOKEN)) {
    if (resolve(name)) continue
    const written = name.trim()
    if (written && !unknown.includes(written)) unknown.push(written)
  }
  return unknown
}

export type SmsTemplateError = 'EMPTY' | 'TOO_LONG'

export const SMS_TEMPLATE_ERROR_LABELS: Record<SmsTemplateError, string> = {
  EMPTY: 'צריך לכתוב הודעה, או לחזור לנוסח ברירת המחדל',
  TOO_LONG: `ההודעה ארוכה מדי - עד ${SMS_TEMPLATE_MAX_CHARS} תווים`,
}

/**
 * Whether this template can be saved.
 *
 * Only two things are refused, and both are about the message being sendable at
 * all: nothing to send, and a message so long it costs a fortune per scan. Using
 * no variables is allowed - "יאללה, עוד אחת!" to everybody who scans is a
 * legitimate thing for a customer to want.
 */
export function validateSmsTemplate(template: string): SmsTemplateError | null {
  const text = template.trim()
  if (text === '') return 'EMPTY'
  if (text.length > SMS_TEMPLATE_MAX_CHARS) return 'TOO_LONG'
  return null
}

/** The reason to show, or '' when the template is fine. */
export function smsTemplateErrorLabel(template: string): string {
  const error = validateSmsTemplate(template)
  return error ? SMS_TEMPLATE_ERROR_LABELS[error] : ''
}
