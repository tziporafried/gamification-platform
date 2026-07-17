import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { PlansModal } from '@/components/PlansModal'

export type PlansOption = 'independent' | 'full' | 'organizations' | 'offline'

export type OpenPlansOptions = {
  eventId?: string | null
  source?: string | null
  plan?: PlansOption | null
  /** Temporary visual emphasis on a plan card (no form open). */
  focusPlan?: PlansOption | null
}

interface PlansModalContextType {
  isOpen: boolean
  openPlans: (opts?: OpenPlansOptions) => void
  closePlans: () => void
}

const PlansModalContext = createContext<PlansModalContextType | undefined>(undefined)

export function PlansModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<OpenPlansOptions>({})

  const openPlans = useCallback((opts: OpenPlansOptions = {}) => {
    setOptions({
      eventId: opts.eventId ?? null,
      source: opts.source ?? null,
      plan: opts.plan ?? null,
      focusPlan: opts.focusPlan ?? null,
    })
    setIsOpen(true)
  }, [])

  const closePlans = useCallback(() => {
    setIsOpen(false)
  }, [])

  const value = useMemo(
    () => ({ isOpen, openPlans, closePlans }),
    [isOpen, openPlans, closePlans],
  )

  return (
    <PlansModalContext.Provider value={value}>
      {children}
      <PlansModal
        isOpen={isOpen}
        onClose={closePlans}
        eventId={options.eventId}
        source={options.source}
        initialPlan={options.plan}
        focusPlan={options.focusPlan}
      />
    </PlansModalContext.Provider>
  )
}

export function usePlansModal() {
  const ctx = useContext(PlansModalContext)
  if (!ctx) throw new Error('usePlansModal must be used within PlansModalProvider')
  return ctx
}
