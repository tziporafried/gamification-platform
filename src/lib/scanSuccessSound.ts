/**
 * Short "successful scan" confirmation - a modern checkout-scanner double beep.
 *
 * "beep-beep": two quick, clean beeps with a tiny gap; the second sits slightly
 * higher than the first (a minor third up) so the pair reads as a positive
 * confirm. Original synthesis - not sampled from any commercial scanner. Sine
 * fundamentals with a faint third harmonic give a crisp beep body without the
 * harshness of a raw square wave. No noise, reverb or echo, and a moderate level
 * so it stays pleasant fired dozens or hundreds of times in a row.
 *
 * Design for repetition and efficiency:
 * - ONE AudioContext for the whole page, created lazily on first play.
 * - The waveform is rendered into an AudioBuffer ONCE and cached; each scan only
 *   spins up a throwaway BufferSourceNode (cheap) and plays the identical buffer.
 *   Sample-identical playback is what keeps it from getting fatiguing.
 * - Everything is wrapped so a blocked/absent Web Audio API fails silently and
 *   never interferes with the scan flow.
 *
 * Only call playScanSuccess() AFTER a scan has actually validated and saved.
 */

// ── Tunables ──────────────────────────────────────────────────────────────────
const DURATION_S = 0.13 // total buffer length (~130ms; both beeps + tiny tail)
const ATTACK_S = 0.004 // fast, click-free ramp up
const RELEASE_S = 0.012 // quick ramp down -> "beep" plateau, not a decaying ping
const HARMONIC = 0.12 // faint 3rd-harmonic edge for a crisp beep timbre
const MASTER_GAIN = 0.8 // moderate; peak stays < ~0.27, no clipping
const END_FADE_S = 0.003 // guarantee true silence at the buffer boundary -> no click

// Two non-overlapping beeps; the second a minor third higher (E6 -> G6). The
// ~18ms gap between them is what makes it read as "beep-beep", not one tone.
interface Beep {
  freq: number
  /** seconds from buffer start */
  start: number
  /** seconds this beep sounds */
  dur: number
  /** linear peak amplitude before master gain */
  peak: number
}
const BEEPS: Beep[] = [
  { freq: 1318.51, start: 0.0, dur: 0.052, peak: 0.3 },
  { freq: 1567.98, start: 0.07, dur: 0.055, peak: 0.3 },
]

// ── Singletons ────────────────────────────────────────────────────────────────
type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext }

let ctx: AudioContext | null = null
let buffer: AudioBuffer | null = null

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

/** Flat-topped beep envelope: quick attack, sustain, quick release (all click-free). */
function beepEnv(local: number, dur: number): number {
  if (local < ATTACK_S) return local / ATTACK_S
  const releaseStart = dur - RELEASE_S
  if (local > releaseStart) return Math.max(0, (dur - local) / RELEASE_S)
  return 1
}

/** Renders the double beep into a mono buffer once, using the context's sample rate. */
function getBuffer(audioCtx: AudioContext): AudioBuffer {
  if (buffer && buffer.sampleRate === audioCtx.sampleRate) return buffer

  const { sampleRate } = audioCtx
  const length = Math.max(1, Math.round(sampleRate * DURATION_S))
  const buf = audioCtx.createBuffer(1, length, sampleRate)
  const data = buf.getChannelData(0)
  const fadeStart = DURATION_S - END_FADE_S

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    let sample = 0

    for (const b of BEEPS) {
      const local = t - b.start
      if (local < 0 || local > b.dur) continue
      // Local time as the phase base -> every beep starts at a zero crossing,
      // so onsets never click.
      const w = 2 * Math.PI * b.freq * local
      const wave = Math.sin(w) + HARMONIC * Math.sin(3 * w)
      sample += b.peak * beepEnv(local, b.dur) * wave
    }

    // Force the tail to true silence before the buffer ends.
    if (t > fadeStart) sample *= Math.max(0, (DURATION_S - t) / END_FADE_S)

    data[i] = sample
  }

  buffer = buf
  return buf
}

/**
 * Optional warm-up: create + resume the AudioContext from inside a user gesture
 * (e.g. the first tap on "start scanning") so the very first beep is instant on
 * Safari/iOS, which start the context suspended until a gesture. Safe to skip -
 * playScanSuccess() also resumes - and safe to call more than once.
 */
export function primeScanSuccess(): void {
  const audioCtx = getCtx()
  if (!audioCtx) return
  try {
    getBuffer(audioCtx)
    if (audioCtx.state === 'suspended') void audioCtx.resume()
  } catch {
    /* ignore */
  }
}

/** Play the confirmation double beep. Call only after a scan has validated and saved. */
export function playScanSuccess(): void {
  const audioCtx = getCtx()
  if (!audioCtx) return
  try {
    // A scan is a user gesture, so a suspended context resumes here in practice.
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    const source = audioCtx.createBufferSource()
    source.buffer = getBuffer(audioCtx)

    const gain = audioCtx.createGain()
    gain.gain.value = MASTER_GAIN

    source.connect(gain)
    gain.connect(audioCtx.destination)
    source.start()
    // Nodes are one-shot; they disconnect themselves when playback ends.
  } catch {
    /* Web Audio unavailable or blocked - stay silent, never break scanning. */
  }
}
