import { useCallback, useRef, useState } from 'react'

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = sampleRate * duration
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const noiseBufferRef = useRef<AudioBuffer | null>(null)
  const [muted, setMuted] = useState(() => {
    return localStorage.getItem('leaderboard-sound-muted') === 'true'
  })

  function getCtx(): AudioContext | null {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext()
      }
      if (ctxRef.current.state === 'suspended') {
        ctxRef.current.resume()
      }
      return ctxRef.current
    } catch {
      return null
    }
  }

  const play = useCallback(() => {
    if (muted) return
    const ctx = getCtx()
    if (!ctx) return

    const now = ctx.currentTime

    const gain1 = ctx.createGain()
    gain1.connect(ctx.destination)
    gain1.gain.setValueAtTime(0.15, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.8)

    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(523.25, now)
    osc1.frequency.setValueAtTime(659.25, now + 0.15)
    osc1.connect(gain1)
    osc1.start(now)
    osc1.stop(now + 0.8)

    const gain2 = ctx.createGain()
    gain2.connect(ctx.destination)
    gain2.gain.setValueAtTime(0, now + 0.1)
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 1.0)

    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(783.99, now + 0.15)
    osc2.connect(gain2)
    osc2.start(now + 0.1)
    osc2.stop(now + 1.0)
  }, [muted])

  const playApplause = useCallback((rank: number) => {
    if (muted) return
    const ctx = getCtx()
    if (!ctx) return

    const duration = rank === 1 ? 3.5 : rank === 2 ? 2.5 : 1.8
    const volume = rank === 1 ? 0.18 : rank === 2 ? 0.12 : 0.08

    if (!noiseBufferRef.current || noiseBufferRef.current.duration < duration) {
      noiseBufferRef.current = createNoiseBuffer(ctx, 4)
    }

    const now = ctx.currentTime

    const layers = rank === 1 ? 3 : 2
    const filterFreqs = [3500, 5000, 7000]

    for (let i = 0; i < layers; i++) {
      const source = ctx.createBufferSource()
      source.buffer = noiseBufferRef.current

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(filterFreqs[i], now)
      filter.Q.setValueAtTime(0.8, now)

      const gain = ctx.createGain()
      const layerVol = volume * (i === 0 ? 1 : 0.6)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(layerVol, now + 0.15)
      gain.gain.setValueAtTime(layerVol, now + duration * 0.6)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      source.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      source.start(now + i * 0.05)
      source.stop(now + duration)
    }
  }, [muted])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      localStorage.setItem('leaderboard-sound-muted', String(next))
      return next
    })
  }, [])

  return { play, playApplause, muted, toggleMute }
}
