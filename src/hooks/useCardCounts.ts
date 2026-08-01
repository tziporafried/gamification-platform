import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { computeCardCounts, EMPTY_CARD_COUNTS, type CardCounts } from '@/lib/cardCounts'

interface GroupJoin { group_id: string }

/**
 * Deck sizes for both scan modes, off the same rows that get printed:
 * participants with their groups, and only *active* actions with theirs.
 *
 * QrCardGenerator arrives at the same numbers, but only after loading the full
 * rows it needs to lay cards out - the cards step has to show them before any
 * of that, so it counts for itself. Both go through computeCardCounts, so the
 * two cannot drift.
 *
 * `enabled` refetches on every transition to true, which is what a wizard step
 * wants: come back to it after adding participants and the numbers are current.
 */
export function useCardCounts(eventId: string, enabled = true) {
  const [cardCounts, setCardCounts] = useState<CardCounts>(EMPTY_CARD_COUNTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function load() {
      const [participantsRes, actionsRes, optionsRes] = await Promise.all([
        supabase.from('participants').select('id, participant_groups(group_id)').eq('event_id', eventId),
        supabase.from('actions').select('id, action_groups(group_id)').eq('event_id', eventId).eq('is_active', true),
        // A database without 088 answers with an error, which counts as no
        // answers - every task is then the one-card task it has always been.
        supabase.from('action_options').select('action_id').eq('event_id', eventId),
      ])
      if (cancelled) return

      const answersPerAction = new Map<string, number>()
      for (const row of (optionsRes.data ?? []) as { action_id: string }[]) {
        answersPerAction.set(row.action_id, (answersPerAction.get(row.action_id) ?? 0) + 1)
      }

      const participants = (participantsRes.data ?? []).map((p) => ({
        groupIds: ((p.participant_groups as unknown as GroupJoin[]) ?? []).map((pg) => pg.group_id),
      }))
      const actions = (actionsRes.data ?? []).map((a) => ({
        groupIds: ((a.action_groups as unknown as GroupJoin[]) ?? []).map((ag) => ag.group_id),
        cardCount: answersPerAction.get(a.id),
      }))

      setCardCounts(computeCardCounts(participants, actions))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [eventId, enabled])

  return { cardCounts, loading }
}
