import { createContext, useContext, useState, ReactNode } from 'react'
import type { UserPlan } from '@/types'

/** When set, controls the free-plan activation CTA in the global header. */
export interface HeaderActivationCta {
  /** Show the header CTA (typically when the in-page CTA is off-screen). */
  visible: boolean
  onClick: () => void
}

interface HeaderSlotContextType {
  centerSlot: ReactNode
  setCenterSlot: (slot: ReactNode) => void
  currentPlan: UserPlan | null
  setCurrentPlan: (plan: UserPlan | null) => void
  currentEventId: string | null
  setCurrentEventId: (id: string | null) => void
  headerActivationCta: HeaderActivationCta | null
  setHeaderActivationCta: (cta: HeaderActivationCta | null) => void
  /** When true, hide the left header activation CTA (inline badge used instead). */
  suppressHeaderActivationCta: boolean
  setSuppressHeaderActivationCta: (suppress: boolean) => void
}

export const HeaderSlotContext = createContext<HeaderSlotContextType | undefined>(undefined)

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [centerSlot, setCenterSlot] = useState<ReactNode>(null)
  const [currentPlan, setCurrentPlan] = useState<UserPlan | null>(null)
  const [currentEventId, setCurrentEventId] = useState<string | null>(null)
  const [headerActivationCta, setHeaderActivationCta] = useState<HeaderActivationCta | null>(null)
  const [suppressHeaderActivationCta, setSuppressHeaderActivationCta] = useState(false)
  return (
    <HeaderSlotContext.Provider
      value={{
        centerSlot,
        setCenterSlot,
        currentPlan,
        setCurrentPlan,
        currentEventId,
        setCurrentEventId,
        headerActivationCta,
        setHeaderActivationCta,
        suppressHeaderActivationCta,
        setSuppressHeaderActivationCta,
      }}
    >
      {children}
    </HeaderSlotContext.Provider>
  )
}

export function useHeaderSlot() {
  const ctx = useContext(HeaderSlotContext)
  if (!ctx) throw new Error('useHeaderSlot must be used within HeaderSlotProvider')
  return ctx
}
