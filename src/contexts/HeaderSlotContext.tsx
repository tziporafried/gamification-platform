import { createContext, useContext, useState, ReactNode } from 'react'
import type { UserPlan } from '@/types'

interface HeaderSlotContextType {
  centerSlot: ReactNode
  setCenterSlot: (slot: ReactNode) => void
  currentPlan: UserPlan | null
  setCurrentPlan: (plan: UserPlan | null) => void
  currentEventId: string | null
  setCurrentEventId: (id: string | null) => void
}

export const HeaderSlotContext = createContext<HeaderSlotContextType | undefined>(undefined)

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [centerSlot, setCenterSlot] = useState<ReactNode>(null)
  const [currentPlan, setCurrentPlan] = useState<UserPlan | null>(null)
  const [currentEventId, setCurrentEventId] = useState<string | null>(null)
  return (
    <HeaderSlotContext.Provider value={{ centerSlot, setCenterSlot, currentPlan, setCurrentPlan, currentEventId, setCurrentEventId }}>
      {children}
    </HeaderSlotContext.Provider>
  )
}

export function useHeaderSlot() {
  const ctx = useContext(HeaderSlotContext)
  if (!ctx) throw new Error('useHeaderSlot must be used within HeaderSlotProvider')
  return ctx
}
