interface QrScanResult {
  participantCode: string
  actionCode: string
}

type ParseQrPayloadResult =
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

  const participantCode = parsed.participantCode as string | undefined
  const actionCode = parsed.actionCode as string | undefined

  if (!participantCode || !actionCode) {
    return { ok: false, error: 'קוד QR חסר — חסר קוד משתתף או קוד משימה.' }
  }

  return { ok: true, data: { participantCode, actionCode } }
}
