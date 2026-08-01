/**
 * Short "successful scan" confirmation - a rising five-note chime.
 *
 * This is the chime that used to fire on a prize win: C5-E5-G5-C6-E6 on triangle
 * waves, each note a quick ramp up then a soft exponential tail, notes 110ms
 * apart so they read as one bright ascending sparkle (~1s in total). The prize
 * celebration now plays the recorded fanfare instead (see rewardFanfareSound.ts),
 * so this chime moved down to the every-scan confirmation.
 *
 * Design for repetition and efficiency:
 * - ONE AudioContext for the whole page, created lazily on first play. The
 *   original prize version built a fresh context per win - fine for a rare
 *   celebration, a leak on a screen that fires hundreds of times a session.
 * - Each scan schedules five throwaway oscillator+gain pairs (cheap); WebAudio
 *   disposes of them when they stop.
 * - Everything is wrapped so a blocked/absent Web Audio API fails silently and
 *   never interferes with the scan flow.
 *
 * Pure synthesis, no audio file - so the offline player plays it as-is.
 *
 * Only call playScanSuccess() AFTER a scan has actually validated and saved.
 */

import { isSoundMuted } from '@/lib/soundMuted'

// ── Tunables ──────────────────────────────────────────────────────────────────
/** C5, E5, G5, C6, E6 - a major arpeggio, ascending. */
const NOTES = [523.25, 659.25, 783.99, 1046.5, 1318.5]
const NOTE_GAP_S = 0.11 // spacing between note onsets
const ATTACK_S = 0.03 // linear ramp up - soft, click-free
const TAIL_S = 0.55 // exponential decay to silence
/**
 * Per-note linear peak. The five tails overlap, so the summed signal peaks at
 * ~0.49 - loud and dominant in a noisy room, still ~2dB under the prize fanfare
 * so a win stays the bigger moment. Raising this to 0.5 makes the two equal.
 */
const PEAK = 0.4

// ── Singletons ────────────────────────────────────────────────────────────────
type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext }

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  try {
    const Ctor = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

/**
 * Optional warm-up: create + resume the AudioContext from inside a user gesture
 * (e.g. the first tap on "start scanning") so the very first chime is instant on
 * Safari/iOS, which start the context suspended until a gesture. Safe to skip -
 * playScanSuccess() also resumes - and safe to call more than once.
 */
export function primeScanSuccess(): void {
  const audioCtx = getCtx()
  if (!audioCtx) return
  try {
    if (audioCtx.state === 'suspended') void audioCtx.resume()
  } catch {
    /* ignore */
  }
}

/**
 * Two flat notes, for a trivia answer that was wrong.
 *
 * Not a buzzer and not an error sound: nothing went wrong, the participant
 * simply picked the other card. A descending pair at a lower volume reads as
 * "noted, not this one" - it has to be distinguishable from the chime above
 * across a noisy room without sounding like the machine rejected the scan.
 */
export function playScanWrongAnswer(): void {
  if (isSoundMuted('scan')) return
  const audioCtx = getCtx()
  if (!audioCtx) return
  try {
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    // G4 then D4 - a falling fourth, well below the success arpeggio.
    ;[392.0, 293.66].forEach((freq, i) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(audioCtx.destination)

      const t = audioCtx.currentTime + i * 0.16
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.26, t + ATTACK_S)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)

      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch {
    /* Same as above - silence is always an acceptable outcome here. */
  }
}

/** Play the confirmation chime. Call only after a scan has validated and saved. */
export function playScanSuccess(): void {
  if (isSoundMuted('scan')) return
  const audioCtx = getCtx()
  if (!audioCtx) return
  try {
    // A scan is a user gesture, so a suspended context resumes here in practice.
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    NOTES.forEach((freq, i) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(audioCtx.destination)

      const t = audioCtx.currentTime + i * NOTE_GAP_S
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(PEAK, t + ATTACK_S)
      // Exponential ramps can't reach 0 - land on a near-silent floor instead.
      gain.gain.exponentialRampToValueAtTime(0.001, t + TAIL_S)

      osc.start(t)
      osc.stop(t + TAIL_S)
    })
    // Nodes are one-shot; they disconnect themselves when playback ends.
  } catch {
    /* Web Audio unavailable or blocked - stay silent, never break scanning. */
  }
}
