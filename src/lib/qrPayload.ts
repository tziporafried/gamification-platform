export interface QrScanResult {
  participantCode?: string
  actionCode?: string
}

export type ParseQrPayloadResult =
  | { ok: true; data: QrScanResult }
  | { ok: false; error: string }

export function parseQrPayload(decodedText: string): ParseQrPayloadResult {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(decodedText)
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
