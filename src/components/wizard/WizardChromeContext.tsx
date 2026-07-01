import { createContext, useContext, useCallback, useRef } from 'react'
import type { WizardState } from '@/types'

interface WizardChromeContextValue {
  hiddenSteps: number[]
  currentStep: number
  wizardState: WizardState
  onStepClick: (step: number) => void
  hasIntroPlayed: (step: number) => boolean
  markIntroPlayed: (step: number) => void
}

export const WizardChromeContext = createContext<WizardChromeContextValue>({
  hiddenSteps: [],
  currentStep: 1,
  wizardState: {
    details: 'not_started',
    groups: 'not_started',
    participants: 'not_started',
    tasks: 'not_started',
    rewards: 'not_started',
    review: 'not_started',
  },
  onStepClick: () => {},
  hasIntroPlayed: () => false,
  markIntroPlayed: () => {},
})

export function useWizardChrome() {
  return useContext(WizardChromeContext)
}

export function useWizardIntroTracking() {
  const introPlayedRef = useRef(new Set<number>())

  const hasIntroPlayed = useCallback((step: number) => introPlayedRef.current.has(step), [])
  const markIntroPlayed = useCallback((step: number) => {
    introPlayedRef.current.add(step)
  }, [])

  return { hasIntroPlayed, markIntroPlayed }
}
