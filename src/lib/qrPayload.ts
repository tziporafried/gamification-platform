import { COMPACT_SEPARATOR } from '@/lib/cardPayload'

/**
 * A decoded card. `combined` carries both codes (single-scan events); the other
 * two are the halves printed for split-scan events.
 */
export type ScannedCode =
  | { kind: 'combined'; participantCode: string; actionCode: string }
  | { kind: 'participant'; participantCode: string }
  | { kind: 'action'; actionCode: string }

type ParseQrPayloadResult =
  | { ok: true; data: ScannedCode }
  | { ok: false; error: string }

function normalizeScanRaw(raw: string): string {
  let text = raw.trim().replace(/^\uFEFF/, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1)
  }
  return text
}

/**
 * Prints exactly what the scanner delivered so an "invalid code" can be
 * diagnosed from the browser console (Hebrew keyboard layout, extra prefixes,
 * hidden characters, wrong symbology). Char codes are included because a
 * Hebrew-layout scramble looks like plain letters but has \u05xx code points.
 */
function logScanDiagnostics(decodedText: string, normalized: string, reason: string): void {
  const codePoints = Array.from(decodedText)
    .map((ch) => `${JSON.stringify(ch)}=U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' ')
  console.warn(
    `[scan] ${reason}\n` +
      `  raw:        ${JSON.stringify(decodedText)}\n` +
      `  normalized: ${JSON.stringify(normalized)}\n` +
      `  length:     ${decodedText.length}\n` +
      `  codePoints: ${codePoints}`,
  )
}

function readCode(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * The one-dimensional (Code128) cards carry a compact `participant*action`
 * string instead of JSON - see `encodeCardPayload`. Exactly one separator, with
 * a missing half left empty, so it splits cleanly back into the same two codes.
 * Returns null when the text is not a compact payload, so `parseQrPayload` can
 * fall through to its diagnostics.
 */
function parseCompactPayload(normalized: string): ScannedCode | null {
  if (normalized.includes('{') || !normalized.includes(COMPACT_SEPARATOR)) return null

  const parts = normalized.split(COMPACT_SEPARATOR)
  if (parts.length !== 2) return null

  const participantCode = readCode(parts[0])
  const actionCode = readCode(parts[1])

  if (participantCode && actionCode) return { kind: 'combined', participantCode, actionCode }
  if (participantCode) return { kind: 'participant', participantCode }
  if (actionCode) return { kind: 'action', actionCode }
  return null
}

export function parseQrPayload(decodedText: string): ParseQrPayloadResult {
  const normalized = normalizeScanRaw(decodedText)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(normalized)
  } catch {
    // Not JSON - it may be a 1D card's compact payload before we give up.
    const compact = parseCompactPayload(normalized)
    if (compact) return { ok: true, data: compact }
    logScanDiagnostics(decodedText, normalized, 'JSON.parse failed — content is not valid JSON')
    return { ok: false, error: 'ברקוד לא תקין - לא ניתן לקרוא את התוכן.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    logScanDiagnostics(decodedText, normalized, 'parsed value is not an object')
    return { ok: false, error: 'ברקוד לא תקין - פורמט לא מזוהה.' }
  }

  const participantCode = readCode(parsed.participantCode)
  const actionCode = readCode(parsed.actionCode)

  if (participantCode && actionCode) {
    return { ok: true, data: { kind: 'combined', participantCode, actionCode } }
  }
  if (participantCode) {
    return { ok: true, data: { kind: 'participant', participantCode } }
  }
  if (actionCode) {
    return { ok: true, data: { kind: 'action', actionCode } }
  }

  logScanDiagnostics(decodedText, normalized, 'no participantCode/actionCode in payload')
  return { ok: false, error: 'ברקוד חסר - חסר קוד משתתף או קוד משימה.' }
}
