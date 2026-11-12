import { isSoundMuted } from '@/lib/soundMuted'

/**
 * The flash challenge's sound cues, one per animation beat:
 *
 *   playFlashZap        the "⚡ אתגר בזק!" burst - an electric rising zap
 *   playFlashTada       the tada wiggle landing - a bright major stab
 *   playFlashWordPop    each word of the title sliding up - a soft pop
 *   playFlashGo         the live stage taking over - two-note "go!"
 *   playFlashTick       every second the clock runs - a soft tick-tock, louder
 *                       through the last ten seconds and sharpest at 3-2-1
 *   playFlashTimesUp    "⏱️ הזמן נגמר!" - a descending buzzer
 *   playFlashFanfare    the summary podium - a short ascending fanfare
 *
 * Pure synthesis, like scanSuccessSound: no audio files, so the offline player
 * plays them as-is. Everything answers to the scan screen's speaker toggle
 * and fails silently when Web Audio is blocked.
 */

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

/** Runs `fn` with a live context, unless the screen is muted or audio is unavailable. */
function play(fn: (ac: AudioContext, t: number) => void): void {
  if (isSoundMuted('scan')) return
  const ac = getCtx()
  if (!ac) return
  try {
    if (ac.state === 'suspended') void ac.resume()
    fn(ac, ac.currentTime + 0.01)
  } catch {
    // Silence is always an acceptable outcome.
  }
}

function tone(
  ac: AudioContext,
  opts: { type?: OscillatorType; freq: number; to?: number; start: number; duration: number; peak?: number },
): void {
  const { type = 'triangle', freq, to, start, duration, peak = 0.2 } = opts
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function noise(ac: AudioContext, start: number, duration: number, opts: { from: number; to: number; peak?: number }): void {
  const frames = Math.max(1, Math.floor(ac.sampleRate * duration))
  const buffer = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(opts.from, start)
  filter.frequency.exponentialRampToValueAtTime(opts.to, start + duration)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(opts.peak ?? 0.15, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ac.destination)
  src.start(start)
  src.stop(start + duration + 0.02)
}

/** Warm the context up from a click, so the first cue after it is not late on Safari. */
export function primeFlashSfx(): void {
  const ac = getCtx()
  if (ac?.state === 'suspended') void ac.resume().catch(() => {})
}

export function playFlashZap(): void {
  play((ac, t) => {
    noise(ac, t, 0.45, { from: 400, to: 6000, peak: 0.18 })
    tone(ac, { type: 'sawtooth', freq: 180, to: 1400, start: t, duration: 0.35, peak: 0.07 })
    tone(ac, { type: 'square', freq: 90, start: t + 0.3, duration: 0.25, peak: 0.08 })
  })
}

export function playFlashTada(): void {
  play((ac, t) => {
    // C major stab, then the octave a beat later - "ta-daa".
    for (const f of [523.25, 659.25, 783.99]) tone(ac, { freq: f, start: t, duration: 0.18, peak: 0.12 })
    for (const f of [659.25, 783.99, 1046.5]) tone(ac, { freq: f, start: t + 0.16, duration: 0.6, peak: 0.12 })
  })
}

export function playFlashWordPop(index = 0): void {
  play((ac, t) => {
    const f = 700 + index * 90
    tone(ac, { type: 'sine', freq: f, to: f * 1.6, start: t, duration: 0.09, peak: 0.12 })
  })
}

export function playFlashGo(): void {
  play((ac, t) => {
    tone(ac, { type: 'square', freq: 880, start: t, duration: 0.12, peak: 0.07 })
    tone(ac, { type: 'square', freq: 1318.5, start: t + 0.13, duration: 0.3, peak: 0.08 })
  })
}

/** Seconds left at which the tick turns from a background tick-tock into a warning. */
const URGENT_TICK_S = 10

export function playFlashTick(secondsLeft: number): void {
  play((ac, t) => {
    if (secondsLeft > URGENT_TICK_S) {
      // A clock's tick-tock: alternating pitch, short and quiet enough to sit
      // under a room's noise without wearing on it for five minutes.
      const tock = secondsLeft % 2 === 0
      tone(ac, { type: 'sine', freq: tock ? 1250 : 1650, start: t, duration: 0.035, peak: 0.07 })
      noise(ac, t, 0.03, { from: 3500, to: 2500, peak: 0.05 })
      return
    }
    const final = secondsLeft <= 3
    tone(ac, {
      type: final ? 'square' : 'triangle',
      freq: final ? 1500 : 1100,
      start: t,
      duration: final ? 0.12 : 0.06,
      peak: final ? 0.12 : 0.1,
    })
  })
}

export function playFlashTimesUp(): void {
  play((ac, t) => {
    tone(ac, { type: 'sawtooth', freq: 440, to: 220, start: t, duration: 0.35, peak: 0.1 })
    tone(ac, { type: 'sawtooth', freq: 330, to: 110, start: t + 0.32, duration: 0.7, peak: 0.12 })
  })
}

export function playFlashFanfare(): void {
  play((ac, t) => {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => tone(ac, { freq: f, start: t + i * 0.12, duration: 0.2, peak: 0.13 }))
    for (const f of [783.99, 1046.5, 1318.5]) tone(ac, { freq: f, start: t + 0.5, duration: 0.9, peak: 0.11 })
  })
}
