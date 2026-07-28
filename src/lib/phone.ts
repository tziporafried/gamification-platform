/**
 * Participant phone numbers, kept in the one shape an SMS gateway accepts.
 *
 * What a person types is never that shape: `050-1234567`, `+972 (0)50 123
 * 4567`, `972501234567`, and - because a spreadsheet stores a phone as a number
 * and eats the leading zero - a bare `501234567` all mean the same line. The
 * database stores E.164 (`+972501234567`) and nothing else, so the gateway is
 * handed a number it can dial and two participants typed differently are not
 * two different numbers.
 *
 * Normalising happens at every door: the inline add field, the row editor and
 * the spreadsheet import all go through `parsePhone`.
 *
 * Israeli numbers are the default because a number with no country code is
 * being typed by somebody in Israel. Anything written with an explicit `+` or
 * `00` keeps its own country code and is only length-checked - guessing what
 * counts as a mobile line abroad is how you reject a real customer.
 */

/** Assumed when the number is written without a country code. */
export const DEFAULT_DIALING_CODE = '972'

/** Why a number was refused - each maps to one sentence for the operator. */
export type PhoneError =
  | 'EMPTY'
  /** Letters, or nothing that could be a number at all. */
  | 'MALFORMED'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  /** A real Israeli number, but a landline - an SMS to it never arrives. */
  | 'NOT_MOBILE'

export interface PhoneResult {
  /** The number in E.164, or null when it was refused. */
  e164: string | null
  error: PhoneError | null
}

export const PHONE_ERROR_LABELS: Record<PhoneError, string> = {
  EMPTY: 'חסר מספר טלפון',
  MALFORMED: 'מספר הטלפון אינו תקין',
  TOO_SHORT: 'מספר הטלפון קצר מדי',
  TOO_LONG: 'מספר הטלפון ארוך מדי',
  NOT_MOBILE: 'זהו מספר קווי - אפשר לשלוח SMS רק לנייד',
}

/** E.164 allows 15 digits including the country code, and nothing shorter than 8 is a line. */
const MIN_DIGITS = 8
const MAX_DIGITS = 15

/** Israeli mobile: 05X and seven more, once the leading zero is off. */
const IL_MOBILE = /^5\d{8}$/
/** Lines that exist but cannot be texted: landlines (0X / 0XX) and VoIP (07X). */
const IL_LANDLINE = /^([23489]\d{7}|7\d{8})$/
const IL_NATIONAL_LENGTH = 9

/** Characters a person legitimately types around the digits. */
const PUNCTUATION = /^[\d\s+\-().]+$/

function fail(error: PhoneError): PhoneResult {
  return { e164: null, error }
}

/**
 * Reads what was typed into an E.164 number, or says why it could not.
 *
 * The shape of the input decides how the digits are read:
 *   `+…` / `00…`   - the country code is stated, so it is kept as written
 *   `972…` (12)    - the country code without its plus, which is what a phone
 *                    exports and a copy-paste usually carries
 *   anything else  - Israeli, with or without the leading zero
 */
export function parsePhone(raw: string | null | undefined): PhoneResult {
  const text = (raw ?? '').trim()
  if (text === '') return fail('EMPTY')
  if (!PUNCTUATION.test(text)) return fail('MALFORMED')

  let digits = text.replace(/\D/g, '')
  if (digits === '') return fail('MALFORMED')

  // `00` is the same statement as `+`, just dialled rather than written.
  const dialledOut = digits.startsWith('00')
  if (dialledOut) digits = digits.slice(2)
  const statesCountry = text.startsWith('+') || dialledOut

  const israeli =
    digits.startsWith(DEFAULT_DIALING_CODE) &&
    (statesCountry || digits.length === DEFAULT_DIALING_CODE.length + IL_NATIONAL_LENGTH)

  if (statesCountry && !israeli) return parseForeign(digits)

  // `+972 (0)50…` is how a number is printed for both audiences at once; the
  // trunk zero is not part of the number once the country code is there.
  const national = (israeli ? digits.slice(DEFAULT_DIALING_CODE.length) : digits).replace(/^0+/, '')

  if (IL_MOBILE.test(national)) return { e164: `+${DEFAULT_DIALING_CODE}${national}`, error: null }
  // Said apart from a plain typo, because "your office number cannot receive
  // an SMS" and "you dropped a digit" ask the operator to do different things.
  if (IL_LANDLINE.test(national)) return fail('NOT_MOBILE')
  return fail(national.length < IL_NATIONAL_LENGTH ? 'TOO_SHORT' : 'TOO_LONG')
}

/**
 * A number that named its own country code. Only its length is checked: which
 * prefixes can receive an SMS is a per-country question this app has no
 * business answering, and refusing a valid number is the worse mistake.
 */
function parseForeign(digits: string): PhoneResult {
  if (digits.length < MIN_DIGITS) return fail('TOO_SHORT')
  if (digits.length > MAX_DIGITS) return fail('TOO_LONG')
  if (digits.startsWith('0')) return fail('MALFORMED')
  return { e164: `+${digits}`, error: null }
}

/** The E.164 number, or null - for callers that do not care why it failed. */
export function normalizePhone(raw: string | null | undefined): string | null {
  return parsePhone(raw).e164
}

export function isValidPhone(raw: string | null | undefined): boolean {
  return parsePhone(raw).e164 !== null
}

/**
 * E.164 back into something readable. Israeli numbers get the grouping they
 * are always written in; a foreign number is left as it is, because the same
 * digits are grouped differently in every country.
 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  const israeliMobile = e164.match(/^\+972(5\d)(\d{3})(\d{4})$/)
  if (!israeliMobile) return e164
  const [, prefix, first, second] = israeliMobile
  return `0${prefix}-${first}-${second}`
}

/** The reason to show, or '' when the number is fine. Empty input is silent. */
export function phoneErrorLabel(raw: string | null | undefined): string {
  const { error } = parsePhone(raw)
  if (!error || error === 'EMPTY') return ''
  return PHONE_ERROR_LABELS[error]
}
