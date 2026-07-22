import type { BarcodeType } from '@/types'

/**
 * What a printed card encodes. `combined` cards carry both codes (single-scan
 * events); the other two are the halves printed for split-scan events. This is
 * the shape both the encoder here and the decoder in `qrPayload.ts` agree on.
 */
export type CardPayload =
  | { participantCode: string; actionCode: string }
  | { participantCode: string }
  | { actionCode: string }

/**
 * Separator between the participant and action code in the one-dimensional
 * (Code128) compact format. Auto-generated codes are `P-1001` / `A-1001` and
 * never contain it, so a single `*` unambiguously splits the two halves.
 */
export const COMPACT_SEPARATOR = '*'

function readCode(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * A QR carries JSON, which a 1D barcode cannot hold practically (the braces and
 * quotes make it far too wide and unreliable). For `code128` we emit a compact
 * `participant*action` string instead, where a missing half is left empty:
 *   - combined:         `P-1001*A-1001`
 *   - participant-only: `P-1001*`  (trailing separator = action absent)
 *   - action-only:      `*A-1001`  (leading separator = participant absent)
 * Every compact payload holds exactly one separator, so the decoder can split
 * it back into the same halves without relying on the codes' contents.
 */
export function encodeCardPayload(payload: CardPayload, type: BarcodeType): string {
  if (type === 'qr') return JSON.stringify(payload)

  const participantCode = 'participantCode' in payload ? readCode(payload.participantCode) : ''
  const actionCode = 'actionCode' in payload ? readCode(payload.actionCode) : ''
  return `${participantCode}${COMPACT_SEPARATOR}${actionCode}`
}
