import { useCallback } from 'react'

export type OpsSoundEvent = 'score' | 'rank_up' | 'rank_1'

export function useOpsSound() {
  const play = useCallback((_event: OpsSoundEvent) => {
    // Placeholder — wire to useSound hook when audio assets are ready
  }, [])
  return { play }
}
