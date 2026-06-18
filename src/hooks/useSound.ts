import { useCallback, useRef, useState } from 'react'

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)
  const [muted, setMuted] = useState(() => {
    return localStorage.getItem('leaderboard-sound-muted') !== 'false'
  })

  const play = useCallback(() => {
    if (muted) return
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext()
      }
      const ctx = ctxRef.current
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
    } catch {
      // Web Audio API not supported — silent failure
    }
  }, [muted])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      localStorage.setItem('leaderboard-sound-muted', String(!next))
      return next
    })
  }, [])

  return { play, muted, toggleMute }
}
