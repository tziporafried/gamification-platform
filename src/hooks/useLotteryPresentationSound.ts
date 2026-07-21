import { useCallback, useEffect, useRef } from 'react'

/** Single continuous intro bed (trimmed + full, ~20.08s). */
export const LOTTERY_INTRO_BED_SOUND_SRC = '/sounds/lottery-intro-bed.mp3'
export const LOTTERY_INTRO_BED_MS = 20_080
/** @deprecated Prefer LOTTERY_INTRO_BED_SOUND_SRC */
export const LOTTERY_INTRO_SOUND_SRC = LOTTERY_INTRO_BED_SOUND_SRC
/** @deprecated Prefer LOTTERY_INTRO_BED_SOUND_SRC */
export const LOTTERY_INTRO_FULL_SOUND_SRC = '/sounds/lottery-intro-full.mp3'
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
 * Lottery presentation audio for a live audience broadcast.
 * Soft / cinematic - no casino or harsh electronic hits.
 */
export function useLotteryPresentationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const fadeTimerRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (fadeTimerRef.current != null) {
      window.clearInterval(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
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
    } catch {
      return null
    }
    return ctxRef.current
  }

  /** Soft UI confirmation click. */
  const playUiClick = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    tone(ctx, { type: 'sine', freq: 880, start: now, duration: 0.06, peak: 0.08 })
    tone(ctx, { type: 'triangle', freq: 1320, start: now + 0.02, duration: 0.08, peak: 0.05 })
  }, [])

  /** Soft airy whoosh + tiny sparkle for rule cards. */
  const playWhoosh = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    noiseBurst(ctx, now, 0.28, 0.055)
    tone(ctx, { type: 'sine', freq: 420, start: now, duration: 0.35, peak: 0.04 })
    tone(ctx, { type: 'triangle', freq: 980, start: now + 0.12, duration: 0.22, peak: 0.06 })
    tone(ctx, { type: 'sine', freq: 1480, start: now + 0.2, duration: 0.18, peak: 0.035 })
  }, [])

  /** Magical shimmer for the prize reveal. */
  const playShimmer = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[988, 1175, 1480, 1760].forEach((freq, i) => {
      tone(ctx, {
        type: 'sine',
        freq,
        start: now + i * 0.05,
        duration: 0.35,
        peak: 0.045 + i * 0.01,
      })
    })
    noiseBurst(ctx, now + 0.08, 0.32, 0.045)
    tone(ctx, { type: 'triangle', freq: 660, start: now, duration: 0.4, peak: 0.035 })
  }, [])

  /** Deep cinematic swell when cards merge. */
  const playMergeSwell = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[110, 165, 220, 330].forEach((freq, i) => {
      tone(ctx, {
        type: 'sine',
        freq,
        start: now + i * 0.07,
        duration: 0.55,
        peak: 0.05 + i * 0.02,
      })
    })
    tone(ctx, { type: 'triangle', freq: 440, start: now + 0.2, duration: 0.5, peak: 0.08 })
    noiseBurst(ctx, now + 0.15, 0.4, 0.06)
  }, [])

  /** Deep cinematic countdown impact. */
  const playCountdownHit = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    tone(ctx, { type: 'sine', freq: 72, start: now, duration: 0.55, peak: 0.22 })
    tone(ctx, { type: 'triangle', freq: 110, start: now, duration: 0.4, peak: 0.12 })
    tone(ctx, { type: 'sine', freq: 220, start: now + 0.02, duration: 0.25, peak: 0.06 })
    noiseBurst(ctx, now, 0.18, 0.05)
  }, [])

  /** Rising GO transition into the draw. */
  const playGoRise = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[330, 392, 494, 660].forEach((freq, i) => {
      tone(ctx, {
        type: 'triangle',
        freq,
        start: now + i * 0.055,
        duration: 0.28,
        peak: 0.07 + i * 0.02,
      })
    })
    noiseBurst(ctx, now + 0.18, 0.3, 0.07)
  }, [])

  const playStepChime = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const melody = [
      { freq: 523.25, t: 0, peak: 0.12 },
      { freq: 659.25, t: 0.08, peak: 0.14 },
      { freq: 783.99, t: 0.16, peak: 0.15 },
    ]
    melody.forEach(({ freq, t, peak }) => {
      tone(ctx, { type: 'triangle', freq, start: now + t, duration: 0.32, peak })
    })
    noiseBurst(ctx, now + 0.2, 0.18, 0.05)
  }, [])

  const playReadySting = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[392, 440, 493.88, 587.33].forEach((freq, i) => {
      tone(ctx, {
        type: 'triangle',
        freq,
        start: now + i * 0.07,
        duration: 0.2,
        peak: 0.05 + i * 0.015,
      })
    })
    tone(ctx, { type: 'sine', freq: 880, start: now + 0.32, duration: 0.4, peak: 0.14 })
    noiseBurst(ctx, now + 0.28, 0.22, 0.07)
  }, [])

  const playWinnerFanfare = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    // Short silence handled by caller; big hit + celebration.
    tone(ctx, { type: 'sine', freq: 98, start: now, duration: 0.5, peak: 0.2 })
    const fanfare = [523.25, 659.25, 783.99, 1046.5]
    fanfare.forEach((freq, i) => {
      tone(ctx, {
        type: 'triangle',
        freq,
        start: now + 0.08 + i * 0.1,
        duration: 0.55,
        peak: 0.15,
      })
      tone(ctx, {
        type: 'sine',
        freq: freq * 2,
        start: now + 0.1 + i * 0.1,
        duration: 0.35,
        peak: 0.05,
      })
    })
    noiseBurst(ctx, now + 0.05, 0.35, 0.1)
    noiseBurst(ctx, now + 0.4, 0.45, 0.08)
  }, [])

  const fadeOut = useCallback(
    (ms = 600, onComplete?: () => void) => {
      const audio = audioRef.current
      if (!audio) {
        onComplete?.()
        return
      }
      if (fadeTimerRef.current != null) {
        window.clearInterval(fadeTimerRef.current)
      }
      const steps = 12
      const stepMs = Math.max(16, ms / steps)
      const startVol = audio.volume
      let step = 0
      fadeTimerRef.current = window.setInterval(() => {
        step += 1
        const next = Math.max(0, startVol * (1 - step / steps))
        audio.volume = next
        if (step >= steps) {
          if (fadeTimerRef.current != null) {
            window.clearInterval(fadeTimerRef.current)
            fadeTimerRef.current = null
          }
          stop()
          onComplete?.()
        }
      }, stepMs)
    },
    [stop],
  )

  const play = useCallback(
    (track: Track, options?: { onEnded?: () => void; volume?: number; loop?: boolean }) => {
      try {
        stop()
        const src = track === 'draw' ? LOTTERY_DRAW_SOUND_SRC : LOTTERY_INTRO_BED_SOUND_SRC
        const audio = new Audio(src)
        audio.volume = options?.volume ?? (track === 'draw' ? 0.78 : 0.7)
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

  /** One continuous intro bed — draw must wait for onEnded. */
  const playIntroBed = useCallback(
    (volume = 0.64, onEnded?: () => void) => {
      play('intro', { loop: false, volume, onEnded })
    },
    [play],
  )

  return {
    play,
    playIntroBed,
    stop,
    fadeOut,
    playUiClick,
    playWhoosh,
    playShimmer,
    playMergeSwell,
    playCountdownHit,
    playGoRise,
    playStepChime,
    playReadySting,
    playWinnerFanfare,
  }
}
