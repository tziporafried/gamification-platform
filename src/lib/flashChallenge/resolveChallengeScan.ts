import { parseQrPayload } from '@/lib/qrPayload'

/**
 * What a scan means while a flash challenge is running: *who is standing here*.
 *
 * Nothing else. The cards were printed before the event and nothing is printed
 * for a challenge, so the challenge borrows whatever card the participant is
 * already holding and reads only its participant half:
 *
 *   split decks     the personal card carries just the participant code.
 *   combined decks  every card is a participant+task pair. The task half is
 *                   ignored - not scored, not marked as done - so the card is
 *                   still good for its task later in the game. A card whose task
 *                   was already done, or a trivia answer card, is accepted the
 *                   same way: only the participant is read.
 *
 * A split-deck task card carries no participant at all, so it cannot say who
 * completed anything and is turned away with its own reason.
 */
export type ChallengeScanResolution =
  | { ok: true; participantCode: string }
  | { ok: false; reason: 'NOT_A_CARD' | 'TASK_CARD_ONLY' }

export function resolveChallengeScan(raw: string): ChallengeScanResolution {
  const parsed = parseQrPayload(raw)
  if (!parsed.ok) return { ok: false, reason: 'NOT_A_CARD' }

  const code = parsed.data
  if (code.kind === 'action') return { ok: false, reason: 'TASK_CARD_ONLY' }
  return { ok: true, participantCode: code.participantCode }
}

/** What the operator is told when they scan a task card instead. */
export function taskCardOnlyMessage(scanMode: string | null | undefined): string {
  return scanMode === 'split' ? 'סרקו את הכרטיס האישי של המשתתף' : 'סרקו כרטיס של המשתתף'
}
