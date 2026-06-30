import { useEffect, useRef } from 'react'
import { syncEventToTemplate } from '@/lib/templates'
import type { EventCounts, GroupType } from '@/types'

interface UseTemplateAutoSyncOptions {
  enabled: boolean
  eventId: string | undefined
  templateId: string | undefined
  groupType: GroupType | null
  counts: EventCounts
  countsLoaded: boolean
}

/** Debounced sync from draft event tables → template tables (mirrors immediate wizard saves). */
export function useTemplateAutoSync({
  enabled,
  eventId,
  templateId,
  groupType,
  counts,
  countsLoaded,
}: UseTemplateAutoSyncOptions) {
  const skipNextRef = useRef(true)

  useEffect(() => {
    skipNextRef.current = true
  }, [eventId, templateId])

  useEffect(() => {
    if (!enabled || !eventId || !templateId || !countsLoaded || groupType === null) return

    if (skipNextRef.current) {
      skipNextRef.current = false
      return
    }

    const timer = window.setTimeout(() => {
      syncEventToTemplate(eventId, templateId, groupType).catch(() => {})
    }, 500)

    return () => window.clearTimeout(timer)
  }, [
    enabled,
    eventId,
    templateId,
    groupType,
    countsLoaded,
    counts.groups,
    counts.tasks,
    counts.rewards,
  ])
}
