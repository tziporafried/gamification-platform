import { useCallback } from 'react'

export type OpsSoundEvent = 'score' | 'bonus_score' | 'rank_up' | 'rank_1' | 'bonus_activated'

export function useOpsSound() {
  const play = useCallback((_event: OpsSoundEvent) => {
    // Placeholder — wire to useSound hook when audio assets are ready
  }, [])
  return { play }
}
