import { useCallback, useEffect, useRef } from 'react'

export const LOTTERY_INTRO_SOUND_SRC = '/sounds/lottery-intro.mp3'
export const LOTTERY_DRAW_SOUND_SRC = '/sounds/lottery-draw.mp3'

type Track = 'intro' | 'draw'

function tone(
  ctx: AudioContext,
  {
    type = 'sine',
    freq,
    start,
    duration,
    peak = 0.18,
    detune = 0,
  }: {
    type?: OscillatorType
    freq: number
    start: number
    duration: number
    peak?: number
    detune?: number
  },
) {
  const gain = ctx.createGain()
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (detune) osc.detune.setValueAtTime(detune, start)
  osc.connect(gain)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

/** Soft noise burst - like a tiny crowd sparkle / shaker. */
function noiseBurst(ctx: AudioContext, start: number, duration: number, peak = 0.08) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 1800
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start(start)
  src.stop(start + duration + 0.02)
}

/**
 * Lottery presentation audio for a live audience broadcast:
 * - game-show step stingers between setting beats
 * - ready / winner fanfares
 * - intro + looping draw soundtrack from /public/sounds
 */
export function useLotteryPresentationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.onended = null
    audio.pause()
    audio.currentTime = 0
    audioRef.current = null
  }, [])

  useEffect(() => () => stop(), [stop])

  function getCtx(): AudioContext | null {
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext()
      if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
      return ctxRef.current
    } catch {
      return null
    }
  }

  /** Bright game-show sparkle after each audience beat. */
  const playStepChime = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const melody = [
      { freq: 523.25, t: 0, peak: 0.14 },
      { freq: 659.25, t: 0.08, peak: 0.16 },
      { freq: 783.99, t: 0.16, peak: 0.18 },
      { freq: 1046.5, t: 0.28, peak: 0.2 },
    ]
    melody.forEach(({ freq, t, peak }) => {
      tone(ctx, { type: 'triangle', freq, start: now + t, duration: 0.38, peak })
      tone(ctx, { type: 'sine', freq: freq * 2, start: now + t, duration: 0.28, peak: peak * 0.35 })
    })
    noiseBurst(ctx, now + 0.26, 0.22, 0.07)
  }, [])

  /** Short “מוכנים??” tease - rising tension into a pop. */
  const playReadySting = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[392, 440, 493.88, 587.33].forEach((freq, i) => {
      tone(ctx, {
        type: 'sawtooth',
        freq,
        start: now + i * 0.07,
        duration: 0.2,
        peak: 0.06 + i * 0.02,
      })
    })
    tone(ctx, { type: 'triangle', freq: 880, start: now + 0.32, duration: 0.45, peak: 0.2 })
    tone(ctx, { type: 'sine', freq: 1320, start: now + 0.34, duration: 0.35, peak: 0.1 })
    noiseBurst(ctx, now + 0.3, 0.28, 0.1)
  }, [])

  /** Big celebration hit when the winner lands. */
  const playWinnerFanfare = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    fanfare.forEach((freq, i) => {
      tone(ctx, {
        type: 'triangle',
        freq,
        start: now + i * 0.09,
        duration: 0.55,
        peak: 0.16,
      })
      tone(ctx, {
        type: 'sine',
        freq: freq * 2,
        start: now + i * 0.09 + 0.02,
        duration: 0.4,
        peak: 0.06,
      })
    })
    noiseBurst(ctx, now, 0.35, 0.12)
    noiseBurst(ctx, now + 0.35, 0.4, 0.09)
  }, [])

  const play = useCallback(
    (track: Track, options?: { onEnded?: () => void; volume?: number; loop?: boolean }) => {
      try {
        stop()
        const src = track === 'intro' ? LOTTERY_INTRO_SOUND_SRC : LOTTERY_DRAW_SOUND_SRC
        const audio = new Audio(src)
        audio.volume = options?.volume ?? (track === 'draw' ? 0.88 : 0.82)
        audio.loop = options?.loop ?? false
        audioRef.current = audio
        if (options?.onEnded) {
          audio.onended = () => options.onEnded?.()
        }
        void audio.play().catch(() => options?.onEnded?.())
      } catch {
        options?.onEnded?.()
      }
    },
    [stop],
  )

  return { play, stop, playStepChime, playReadySting, playWinnerFanfare }
}
