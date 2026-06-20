import { useCallback, useRef } from 'react'

export function useCelebrationSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const play = useCallback(() => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext()
      }
      const ctx = ctxRef.current

      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime

      const notes = [523.25, 659.25, 783.99, 1046.50]
      notes.forEach((freq, i) => {
        const gain = ctx.createGain()
        gain.connect(ctx.destination)
        const start = now + i * 0.15
        gain.gain.setValueAtTime(0.18, start)
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.6)

        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, start)
        osc.connect(gain)
        osc.start(start)
        osc.stop(start + 0.6)
      })

      const chordStart = now + 0.6
      ;[523.25, 659.25, 783.99, 1046.50].forEach((freq) => {
        const gain = ctx.createGain()
        gain.connect(ctx.destination)
        gain.gain.setValueAtTime(0.08, chordStart)
        gain.gain.exponentialRampToValueAtTime(0.01, chordStart + 1.2)

        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, chordStart)
        osc.connect(gain)
        osc.start(chordStart)
        osc.stop(chordStart + 1.2)
      })
    } catch {
      // Web Audio API not supported or blocked — silent failure
    }
  }, [])

  return { play }
}
