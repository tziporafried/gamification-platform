import { createContext, useContext } from 'react'

interface WizardChromeContextValue {
  hiddenSteps: number[]
  onStepClick: (step: number) => void
}

export const WizardChromeContext = createContext<WizardChromeContextValue>({
  hiddenSteps: [],
  onStepClick: () => {},
})

export function useWizardChrome() {
  return useContext(WizardChromeContext)
}
