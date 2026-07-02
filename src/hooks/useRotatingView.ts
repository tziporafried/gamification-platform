import { useState, useEffect } from 'react'

export function useRotatingView(intervalMs = 10000): 0 | 1 {
  const [view, setView] = useState<0 | 1>(0)
  useEffect(() => {
    const t = setInterval(() => setView(v => (v === 0 ? 1 : 0)), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return view
}
