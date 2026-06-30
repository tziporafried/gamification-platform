export interface QrScanResult {
  participantCode?: string
  actionCode?: string
}

export type ParseQrPayloadResult =
  | { ok: true; data: QrScanResult }
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

export function parseQrPayload(decodedText: string): ParseQrPayloadResult {
  const normalized = normalizeScanRaw(decodedText)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(normalized)
  } catch {
    return { ok: false, error: 'קוד QR לא תקין — לא ניתן לקרוא את התוכן.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'קוד QR לא תקין — פורמט לא מזוהה.' }
  }

  const type = parsed.type as string | undefined

  if (type === 'combined_score' || (!type && parsed.participantCode && parsed.actionCode)) {
    const participantCode = parsed.participantCode as string
    const actionCode = parsed.actionCode as string
    if (!participantCode || !actionCode) {
      return { ok: false, error: 'קוד QR חסר — חסר קוד משתתף או קוד משימה.' }
    }
    return { ok: true, data: { participantCode, actionCode } }
  }

  if (type === 'participant') {
    const participantCode = parsed.participantCode as string
    if (!participantCode) {
      return { ok: false, error: 'קוד QR חסר — חסר קוד משתתף.' }
    }
    return { ok: true, data: { participantCode } }
  }

  if (type === 'action') {
    const actionCode = parsed.actionCode as string
    if (!actionCode) {
      return { ok: false, error: 'קוד QR חסר — חסר קוד משימה.' }
    }
    return { ok: true, data: { actionCode } }
  }

  return { ok: false, error: 'קוד QR לא מזוהה — סוג לא נתמך.' }
}
