import { useState, useEffect, useRef, useCallback } from 'react'

export type WinnerPhase = 'hidden' | 'entrance' | 'counting' | 'named'

interface RevealState {
  phases: Record<number, WinnerPhase>
  isComplete: boolean
  activeRank: number | null
}

const REVEAL_ORDER = [3, 2, 1] as const
const ENTRANCE_DELAY = 600
const PAUSE_BETWEEN = 600
const NAME_DELAY = 400
const COUNT_DURATIONS: Record<number, number> = { 3: 1200, 2: 1500, 1: 1800 }

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function buildInitial(ranks: number[]): Record<number, WinnerPhase> {
  const phases: Record<number, WinnerPhase> = {}
  for (const r of ranks) phases[r] = 'hidden'
  return phases
}

function buildFinal(ranks: number[]): Record<number, WinnerPhase> {
  const phases: Record<number, WinnerPhase> = {}
  for (const r of ranks) phases[r] = 'named'
  return phases
}

export function useRevealSequence(availableRanks: number[]) {
  const ranks = REVEAL_ORDER.filter((r) => availableRanks.includes(r))
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const [state, setState] = useState<RevealState>(() => {
    if (prefersReducedMotion() || ranks.length === 0) {
      return { phases: buildFinal(ranks), isComplete: true, activeRank: null }
    }
    return { phases: buildInitial(ranks), isComplete: false, activeRank: null }
  })

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
  }, [])

  const runSequence = useCallback(() => {
    clearTimers()

    if (ranks.length === 0) {
      setState({ phases: buildFinal(ranks), isComplete: true, activeRank: null })
      return
    }

    if (prefersReducedMotion()) {
      setState({ phases: buildFinal(ranks), isComplete: true, activeRank: null })
      return
    }

    setState({ phases: buildInitial(ranks), isComplete: false, activeRank: null })

    const schedule = (fn: () => void, delay: number) => {
      const t = setTimeout(fn, delay)
      timersRef.current.push(t)
    }

    schedule(() => {
      setState((s) => {
        const p = { ...s.phases }
        for (const r of ranks) p[r] = 'entrance'
        return { ...s, phases: p }
      })
    }, 50)

    let cursor = ENTRANCE_DELAY

    for (let i = 0; i < ranks.length; i++) {
      const rank = ranks[i]
      const countDuration = COUNT_DURATIONS[rank] ?? 1500

      if (i > 0) cursor += PAUSE_BETWEEN

      const countTime = cursor
      schedule(() => {
        setState((s) => ({
          ...s,
          phases: { ...s.phases, [rank]: 'counting' },
          activeRank: rank,
        }))
      }, countTime)

      cursor += countDuration + NAME_DELAY

      const nameTime = cursor
      const isLast = i === ranks.length - 1
      schedule(() => {
        setState((s) => ({
          ...s,
          phases: { ...s.phases, [rank]: 'named' },
          activeRank: rank,
          isComplete: isLast,
        }))
      }, nameTime)
    }
  }, [ranks.join(','), clearTimers])

  useEffect(() => {
    runSequence()
    return clearTimers
  }, [])

  const skip = useCallback(() => {
    clearTimers()
    setState({ phases: buildFinal(ranks), isComplete: true, activeRank: null })
  }, [ranks.join(','), clearTimers])

  const replay = useCallback(() => {
    runSequence()
  }, [runSequence])

  return { ...state, skip, replay }
}
