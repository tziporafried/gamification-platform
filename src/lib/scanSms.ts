/**
 * The text a participant gets after a scan.
 *
 * One scan, one message: how many points it was worth, which task earned them,
 * and how many the participant now has in total. That is the whole product -
 * somebody who scanned a card at a station and walked away gets their score in
 * their pocket instead of having to find the leaderboard screen. The wording is
 * the customer's, written on the wizard's SMS step and stored on the game
 * (`events.sms_template`); filling it in is src/lib/smsTemplate.ts.
 *
 * Sent only by games with the `sms_notifications` flag (src/lib/smsNotifications.ts),
 * which is also the flag that collects the phone numbers in the first place and
 * the flag that shows the wizard step. Without it there is no phone to text, no
 * template to send, and nothing here ever runs.
 *
 * ── What is finished and what is not ─────────────────────────────────────────
 * Everything up to the gateway is real: the flag check, the phone lookup, the
 * template, the message. `sendSms` is the one deliberate hole - it takes a
 * finished message and returns NO_PROVIDER without dialling anybody, because
 * there is no provider or API key yet. Wiring one up is a change to that single
 * function, and every caller and every message stays as it is.
 *
 * When the provider arrives, the key does NOT belong here. This file runs in the
 * kiosk's browser, where anything it holds is readable by whoever is standing at
 * the machine. The send belongs in a Supabase edge function next to
 * notify-contact-request, and `sendSms` becomes one `supabase.functions.invoke`
 * with the body below - see the note on the function itself.
 *
 * ── Never in the way of a scan ───────────────────────────────────────────────
 * A text is the smallest thing happening at that moment. The scan is already
 * recorded and the celebration is already on screen by the time this is called,
 * it is never awaited, and nothing it can do - no phone, no column, no gateway,
 * a thrown error - is allowed to surface at the kiosk. Failures resolve to a
 * reason, and the caller drops it.
 *
 * The offline player (src/lib/offline) has no network at all and sends nothing;
 * its scans score exactly as before.
 */

import { supabase } from '@/lib/supabase'
import { renderSmsTemplate } from '@/lib/smsTemplate'

/** One scan, as much of it as a message needs. */
export interface ScanSms {
  eventId: string
  participantId: string
  participantName: string
  actionName: string
  /** Points this scan was worth. */
  points: number
  /** What the participant has after it. */
  totalPoints: number
  /**
   * The point_transactions row this text is about. Carried so a gateway can be
   * asked for it twice - a retried send, a double-fired effect - and still text
   * the participant once.
   */
  transactionId: string
}

/** Why no message went out. Nothing here is an error the operator can act on. */
export type SmsSkipReason =
  /** No gateway is wired up yet - the expected answer until one is. */
  | 'NO_PROVIDER'
  /** This participant was added without a number, or before the flag was on. */
  | 'NO_PHONE'
  /** The phone could not be read - offline, or migration 081 not applied. */
  | 'LOOKUP_FAILED'

export interface SmsDelivery {
  sent: boolean
  /** Null once something actually sent. */
  reason: SmsSkipReason | null
  /** The message that was (or would have been) sent. */
  body: string
}

export interface SmsRequest {
  /** E.164, exactly as the column stores it. */
  to: string
  body: string
  /** Same value for the same scan, so a repeat send is one text. */
  idempotencyKey: string
}

/**
 * Hands one message to the gateway. Currently hands it to nobody.
 *
 * This is the empty function - the single place a provider gets wired in. It
 * takes the finished message rather than the scan on purpose: what to say is
 * settled by the customer's template and rendered before we get here, and
 * whoever adds Twilio / 019 / Inforu / whichever gateway is chosen only has to
 * make one HTTP call happen.
 *
 * What that looks like, once the key exists as a secret on the edge function:
 *
 *   const { error } = await supabase.functions.invoke('send-scan-sms', {
 *     body: { to: request.to, text: request.body, key: request.idempotencyKey },
 *   })
 *   if (error) return { sent: false, reason: 'NO_PROVIDER', body: request.body }
 *   return { sent: true, reason: null, body: request.body }
 *
 * The edge function holds the credentials and does the dialling; nothing about
 * the provider reaches this file, and no key is ever shipped to a kiosk.
 *
 * Until then this resolves rather than throws, so the path stays exercised end
 * to end: every scan in a game with the flag really does reach here with a real
 * number and the real message that game would have sent.
 */
export async function sendSms(request: SmsRequest): Promise<SmsDelivery> {
  return { sent: false, reason: 'NO_PROVIDER', body: request.body }
}

/**
 * The participant's number, or null.
 *
 * Read on its own, after the scan is already saved, and never as part of the
 * scoring query - `phone` only exists once migration 081 has been applied, and a
 * database still missing it must fail to text somebody, not fail to score them.
 */
async function participantPhone(participantId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('participants')
    .select('phone')
    .eq('id', participantId)
    .maybeSingle()

  if (error) return null
  return (data?.phone as string | null) ?? null
}

/**
 * The game's own wording and its name, for the message.
 *
 * Read per scan rather than cached: the operator can be editing the sentence in
 * the wizard on one screen while a station scans on another, and the version
 * that goes out should be the one they just saved. It is one indexed read
 * against a row the app has usually already touched.
 *
 * A null template is the ordinary state - it means nobody changed the default.
 */
async function eventMessaging(eventId: string): Promise<{ template: string | null; name: string }> {
  const { data, error } = await supabase
    .from('events')
    .select('name, sms_template')
    .eq('id', eventId)
    .maybeSingle()

  if (error || !data) return { template: null, name: '' }
  return {
    template: (data.sms_template as string | null) ?? null,
    name: (data.name as string | null) ?? '',
  }
}

/**
 * Text this participant about this scan. Resolves; never throws, never rejects.
 *
 * Call it without awaiting: the celebration on screen belongs to the scan, not
 * to the gateway. The return value is there for tests and for a future send log.
 */
export async function notifyScanBySms(scan: ScanSms): Promise<SmsDelivery> {
  try {
    const [phone, messaging] = await Promise.all([
      participantPhone(scan.participantId),
      eventMessaging(scan.eventId),
    ])

    const body = renderSmsTemplate(messaging.template, {
      name: scan.participantName,
      task: scan.actionName,
      points: scan.points,
      total: scan.totalPoints,
      event: messaging.name,
    })

    // Ordinary, not exceptional: a roster imported before the game was sold SMS
    // has numbers for nobody, and those participants simply score in silence.
    if (!phone) return { sent: false, reason: 'NO_PHONE', body }
    return await sendSms({ to: phone, body, idempotencyKey: scan.transactionId })
  } catch {
    return { sent: false, reason: 'LOOKUP_FAILED', body: '' }
  }
}
