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
  /** Participant name, first and family joined - what the app displays. */
  name: string
  /**
   * The given name on its own, for a message that greets somebody rather than
   * addressing them. Falls back to the whole name, so a game whose roster was
   * typed by hand - where there is no division to make - greets דנה כהן by her
   * whole name rather than by nothing at all.
   */
  firstName: string
  /** The family name, or '' when there is none. See migration 083. */
  lastName: string
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
  // The name is offered in halves and only in halves. Whoever wants the whole
  // of it writes `{{שם פרטי}} {{שם משפחה}}`, which costs one chip more and buys
  // the thing a single joined variable could never do: greet somebody by name.
  { token: 'שם פרטי', label: 'שם פרטי', sample: 'שרה', aliases: ['פרטי', 'first name', 'firstname', 'first', 'given name'] },
  { token: 'שם משפחה', label: 'שם משפחה', sample: 'כהן', aliases: ['משפחה', 'last name', 'lastname', 'surname', 'family name'] },
  // Labels are the tokens themselves, near enough. Splitting the name into two
  // chips made six of them, and six sentences do not fit on one row - where a
  // second row pushes the chips away from the box they write into. The token is
  // on each chip's tooltip, and the preview underneath says what it fills in.
  // The samples are deliberately not a sports day. The step is read by schools,
  // companies and family events too, and an example that assumes one kind of
  // customer is the fastest way to make the rest feel the product is not for
  // them. A riddle at a בר מצווה is closer to the middle of who buys this.
  { token: 'משימה', label: 'משימה', sample: 'פתרת חידה', aliases: ['task', 'action'] },
  { token: 'ניקוד', label: 'ניקוד', sample: '10', aliases: ['points', 'score'] },
  { token: 'סהכ', label: 'סה"כ', sample: '120', aliases: ['סה"כ', 'סה״כ', 'total'] },
  { token: 'פעילות', label: 'פעילות', sample: 'ערב גיבוש חורף', aliases: ['event', 'game'] },
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
  'היי {{שם פרטי}}! קיבלת {{ניקוד}} נק\' על "{{משימה}}". סה"כ יש לך {{סהכ}} נק\'.'

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

/**
 * The joined name, as the step used to offer it.
 *
 * Retired from the chips above - it is `{{שם פרטי}} {{שם משפחה}}` now - but it
 * still fills in, because customers have templates saved with it and a variable
 * that stops resolving does not fall back, it goes out in the message with its
 * braces on. There is no chip for it, so nobody writes a new one.
 */
const LEGACY_FULL_NAME_TOKEN = 'שם'
const LEGACY_FULL_NAME_ALIASES = ['שם', 'name', 'participant']

/** `{{ שם פרטי }}`, with whatever spacing somebody typed inside the braces. */
const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g

/**
 * The same token with the horizontal space in front of it, so a variable that
 * fills in as nothing takes its own separator with it - see renderSmsTemplate.
 */
const TOKEN_WITH_LEAD = /([^\S\n]*)\{\{\s*([^{}]*?)\s*\}\}/g

/** Every spelling that resolves to a variable, mapped to its canonical token. */
const BY_NAME = new Map<string, string>([
  ...SMS_VARIABLES.flatMap((v) =>
    [v.token, ...v.aliases].map((name): [string, string] => [name.toLowerCase(), v.token]),
  ),
  ...LEGACY_FULL_NAME_ALIASES.map((name): [string, string] => [name.toLowerCase(), LEGACY_FULL_NAME_TOKEN]),
])

function resolve(name: string): string | null {
  return BY_NAME.get(name.toLowerCase()) ?? null
}

function valueFor(token: string, values: SmsValues): string {
  switch (token) {
    case 'שם':
      return values.name
    case 'שם פרטי':
      return values.firstName || values.name
    case 'שם משפחה':
      return values.lastName
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

  const filled = source.replace(TOKEN_WITH_LEAD, (whole, lead: string, name: string) => {
    const token = resolve(name)
    if (!token) return whole
    const value = valueFor(token, values)
    // An empty value takes the space in front of it with it. `{{שם פרטי}}
    // {{שם משפחה}}` is how the whole name is written now, and in a game whose
    // roster was typed by hand there is no family name - so without this every
    // message reads "היי דנה , קיבלת" and pays for the extra character too.
    return value === '' ? '' : lead + value
  })

  return filled.replace(/[^\S\n]+$/gm, '').trim()
}

/** The sample message the wizard step shows while the operator types. */
export function previewSmsTemplate(template: string | null | undefined): string {
  const samples = Object.fromEntries(SMS_VARIABLES.map((v) => [v.token, v.sample]))
  return renderSmsTemplate(template, {
    // The retired variable has no chip and so no sample of its own; a template
    // still carrying it previews as the two halves it stands for.
    name: `${samples['שם פרטי']} ${samples['שם משפחה']}`,
    firstName: samples['שם פרטי'],
    lastName: samples['שם משפחה'],
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
