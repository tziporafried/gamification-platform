import { useState, useEffect, useRef } from 'react'

export function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    startTimeRef.current = null

    function step(timestamp: number) {
      if (startTimeRef.current === null) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}
