import { useState, useCallback, useMemo, useEffect } from 'react'
import { getWizardPrefs, setWizardPrefs, computeWizardState } from '@/lib/wizard'
import type { Event, EventCounts, WizardState, GroupType } from '@/types'

export function useWizardState(event: Event | null, counts: EventCounts, countsLoaded: boolean) {
  const [groupType, setGroupTypeRaw] = useState<GroupType | null>(
    () => event ? getWizardPrefs(event.id).groupType : null
  )

  // Resolve groupType: DB groups > 0 always wins, then localStorage, then default
  useEffect(() => {
    if (!countsLoaded || !event) return

    if (counts.groups > 0) {
      setGroupTypeRaw('custom')
      setWizardPrefs(event.id, { groupType: 'custom' })
      return
    }

    const saved = getWizardPrefs(event.id)
    if (saved.groupType !== null) {
      setGroupTypeRaw(saved.groupType)
    }
  }, [countsLoaded, counts.groups, event?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const wizardState: WizardState = useMemo(() => {
    if (!event) return { details: 'not_started', groups: 'not_started', participants: 'not_started', tasks: 'not_started', rewards: 'not_started', review: 'not_started' }
    return computeWizardState(event, counts, groupType)
  }, [event, counts, groupType])

  const setGroupType = useCallback((type: GroupType) => {
    setGroupTypeRaw(type)
    if (event) setWizardPrefs(event.id, { groupType: type })
  }, [event])

  return { wizardState, groupType, setGroupType }
}
