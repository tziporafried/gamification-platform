import { SkipForward, RotateCcw } from 'lucide-react'
import { useRevealSequence } from '@/hooks/useRevealSequence'
import { RevealPodium } from './RevealPodium'
import { useEffect, useRef } from 'react'

interface WinnerEntry {
  rank: 1 | 2 | 3
  name: string
  detail?: string
  color?: string
  total_points: number
}

interface WinnersRevealProps {
  entries: WinnerEntry[]
  themeColor: string
  play: () => void
  playApplause: (rank: number) => void
  muted: boolean
}

export function WinnersReveal({ entries, play, playApplause, muted }: WinnersRevealProps) {
  const availableRanks = entries.map((e) => e.rank)
  const { phases, isComplete, skip, replay } = useRevealSequence(availableRanks)
  const prevNamedRanks = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (muted) return
    for (const entry of entries) {
      if (phases[entry.rank] === 'named' && !prevNamedRanks.current.has(entry.rank)) {
        prevNamedRanks.current.add(entry.rank)
        play()
        playApplause(entry.rank)
      }
    }
  }, [phases, entries, play, playApplause, muted])

  useEffect(() => {
    prevNamedRanks.current = new Set()
  }, [availableRanks.join(',')])

  if (entries.length === 0) return null

  const first = entries.find((e) => e.rank === 1)
  const second = entries.find((e) => e.rank === 2)
  const third = entries.find((e) => e.rank === 3)

  return (
    <div className="relative pb-6">
      {/* Desktop layout: 2nd | 1st (elevated) | 3rd */}
      <div className="hidden sm:grid sm:grid-cols-3 sm:items-end sm:gap-4">
        <div className="pt-8">
          {second && (
            <RevealPodium
              rank={2}
              name={second.name}
              detail={second.detail}
              color={second.color}
              totalPoints={second.total_points}
              phase={phases[2] ?? 'hidden'}
            />
          )}
        </div>
        <div>
          {first && (
            <RevealPodium
              rank={1}
              name={first.name}
              detail={first.detail}
              color={first.color}
              totalPoints={first.total_points}
              phase={phases[1] ?? 'hidden'}
            />
          )}
        </div>
        <div className="pt-8">
          {third && (
            <RevealPodium
              rank={3}
              name={third.name}
              detail={third.detail}
              color={third.color}
              totalPoints={third.total_points}
              phase={phases[3] ?? 'hidden'}
            />
          )}
        </div>
      </div>

      {/* Mobile layout: stacked 1st → 2nd → 3rd */}
      <div className="flex flex-col gap-3 sm:hidden">
        {[first, second, third].filter(Boolean).map((entry) => (
          <RevealPodium
            key={entry!.rank}
            rank={entry!.rank}
            name={entry!.name}
            detail={entry!.detail}
            color={entry!.color}
            totalPoints={entry!.total_points}
            phase={phases[entry!.rank] ?? 'hidden'}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="mt-6 flex justify-center gap-3">
        {!isComplete && (
          <button
            onClick={skip}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/15 hover:text-gray-200"
          >
            <SkipForward size={14} />
            דילוג
          </button>
        )}
        {isComplete && (
          <button
            onClick={() => {
              prevNamedRanks.current = new Set()
              replay()
            }}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/15 hover:text-gray-200 animate-fade-in-up"
          >
            <RotateCcw size={14} />
            הפעלה מחדש
          </button>
        )}
      </div>
    </div>
  )
}
