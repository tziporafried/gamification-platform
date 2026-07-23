import { useCallback, useRef } from 'react'
import { isSoundMuted } from '@/lib/soundMuted'

function tone(
  ctx: AudioContext,
  {
    type = 'sine',
    freq,
    start,
    duration,
    peak = 0.12,
  }: {
    type?: OscillatorType
    freq: number
    start: number
    duration: number
    peak?: number
  },
) {
  const gain = ctx.createGain()
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  osc.connect(gain)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function noiseBurst(ctx: AudioContext, start: number, duration: number, peak = 0.06) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2400
  filter.Q.value = 0.7
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start(start)
  src.stop(start + duration + 0.02)
}

/**
 * Physical micro-SFX for the raffle ceremony (paper, glass, shimmer).
 * Ambient draw bed stays in useLotteryPresentationSound.
 */
export function useRaffleDrawSfx() {
  const ctxRef = useRef<AudioContext | null>(null)

  function getCtx(): AudioContext | null {
    if (isSoundMuted('lottery')) return null
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext()
      if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
    } catch {
      return null
    }
    return ctxRef.current
  }

  const playPaperFlutter = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    noiseBurst(ctx, now, 0.07, 0.035)
    tone(ctx, { type: 'triangle', freq: 620 + Math.random() * 180, start: now, duration: 0.05, peak: 0.03 })
  }, [])

  const playTicketInsert = useCallback((final = false) => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    noiseBurst(ctx, now, final ? 0.14 : 0.08, final ? 0.09 : 0.05)
    tone(ctx, {
      type: 'sine',
      freq: final ? 340 : 410 + Math.random() * 90,
      start: now,
      duration: final ? 0.18 : 0.1,
      peak: final ? 0.07 : 0.04,
    })
  }, [])

  const playBoxRumble = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    tone(ctx, { type: 'sine', freq: 55, start: now, duration: 0.55, peak: 0.12 })
    tone(ctx, { type: 'triangle', freq: 90, start: now + 0.04, duration: 0.4, peak: 0.05 })
    noiseBurst(ctx, now + 0.02, 0.35, 0.045)
  }, [])

  const playSilenceShimmer = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    ;[988, 1175, 1480].forEach((freq, i) => {
      tone(ctx, {
        type: 'sine',
        freq,
        start: now + i * 0.07,
        duration: 0.45,
        peak: 0.035 + i * 0.01,
      })
    })
  }, [])

  const playTicketUnfold = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    noiseBurst(ctx, now, 0.16, 0.06)
    tone(ctx, { type: 'triangle', freq: 520, start: now + 0.04, duration: 0.28, peak: 0.05 })
  }, [])

  const playLidClick = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    tone(ctx, { type: 'triangle', freq: 880, start: now, duration: 0.05, peak: 0.07 })
    tone(ctx, { type: 'sine', freq: 220, start: now + 0.02, duration: 0.12, peak: 0.06 })
    noiseBurst(ctx, now, 0.06, 0.04)
  }, [])

  const playMagneticWhoosh = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    tone(ctx, { type: 'sine', freq: 180, start: now, duration: 0.14, peak: 0.025 })
    tone(ctx, { type: 'triangle', freq: 320 + Math.random() * 40, start: now + 0.02, duration: 0.1, peak: 0.02 })
  }, [])

  const playCinematicHit = useCallback(() => {
    const ctx = getCtx()
    if (!ctx) return
    const now = ctx.currentTime
    tone(ctx, { type: 'sine', freq: 70, start: now, duration: 0.45, peak: 0.14 })
    tone(ctx, { type: 'triangle', freq: 196, start: now + 0.03, duration: 0.35, peak: 0.06 })
    noiseBurst(ctx, now, 0.2, 0.07)
  }, [])

  return {
    playPaperFlutter,
    playTicketInsert,
    playBoxRumble,
    playSilenceShimmer,
    playTicketUnfold,
    playLidClick,
    playMagneticWhoosh,
    playCinematicHit,
  }
}
