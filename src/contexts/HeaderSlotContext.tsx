import { createContext, useContext, useState, ReactNode } from 'react'

interface HeaderSlotContextType {
  centerSlot: ReactNode
  setCenterSlot: (slot: ReactNode) => void
}

const HeaderSlotContext = createContext<HeaderSlotContextType | undefined>(undefined)

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [centerSlot, setCenterSlot] = useState<ReactNode>(null)
  return (
    <HeaderSlotContext.Provider value={{ centerSlot, setCenterSlot }}>
      {children}
    </HeaderSlotContext.Provider>
  )
}

export function useHeaderSlot() {
  const ctx = useContext(HeaderSlotContext)
  if (!ctx) throw new Error('useHeaderSlot must be used within HeaderSlotProvider')
  return ctx
}
