import { createContext, useContext } from 'react'
import type { WizardState } from '@/types'

interface WizardChromeContextValue {
  hiddenSteps: number[]
  currentStep: number
  wizardState: WizardState
  onStepClick: (step: number) => void
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
})

export function useWizardChrome() {
  return useContext(WizardChromeContext)
}
