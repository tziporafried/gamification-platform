import { useState, useEffect } from 'react'

interface PointsFlyUpProps {
  points: number | null
  onDone: () => void
}

export function PointsFlyUp({ points, onDone }: PointsFlyUpProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (points === null) return
    setVisible(true)
    const timer = setTimeout(() => {
      setVisible(false)
      onDone()
    }, 1000)
    return () => clearTimeout(timer)
  }, [points, onDone])

  if (!visible || points === null) return null

  const isPositive = points >= 0
  const sign = isPositive ? '+' : ''

  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 flex justify-center">
      <span
        className={`animate-float-up text-2xl font-bold ${
          isPositive ? 'text-emerald-500' : 'text-red-500'
        }`}
      >
        {sign}{points} pts
      </span>
    </div>
  )
}
