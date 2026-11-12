import { supabase } from '@/lib/supabase'

/**
 * The participant a scanned card belongs to, in this game.
 *
 * The printed participant code is the participant's `external_id`, scoped to
 * the event - a card from another game resolves to nothing. Every screen that
 * reads a participant off a card (the kiosk's scoring, the flash challenge)
 * asks through here, so there is one answer to "who is this card".
 */
export function findParticipantByCode(eventId: string, participantCode: string) {
  return supabase
    .from('participants')
    .select('id, name')
    .eq('event_id', eventId)
    .eq('external_id', participantCode.trim())
    .maybeSingle()
}
