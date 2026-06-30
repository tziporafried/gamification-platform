import { useState, useEffect, useRef } from 'react'
import { Layers, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { UpgradeModal } from '@/components/UpgradeModal'
import { GroupForm } from './GroupForm'
import { GroupCard } from './GroupCard'
import { InlineAddGroup } from './InlineAddGroup'
import { getLockedTemplate, LOCKED_TEMPLATE_CHANGED } from '@/lib/lockedTemplate'
import type { ActivityTemplateGroup, Group, GroupWithCount } from '@/types'

interface GroupListProps {
  eventId: string
  onCountChange: (count: number) => void
}

function LockedGroupCard({ group }: { group: ActivityTemplateGroup }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-game-card/50 opacity-50 select-none">
      <div className="h-1.5 w-full bg-white/10" />
      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5">
            <Lock size={12} className="text-zinc-500" />
          </div>
          <span className="flex-1 truncate text-sm font-semibold text-zinc-500">{group.name}</span>
          <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500/60">
            פרמיום
          </span>
        </div>
      </div>
    </div>
  )
}

export function GroupList({ eventId, onCountChange }: GroupListProps) {
  const [groups, setGroups] = useState<GroupWithCount[]>([])
  const [lockedGroups, setLockedGroups] = useState<ActivityTemplateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupWithCount | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<GroupWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  useEffect(() => {
    function syncLocked() {
      setLockedGroups(getLockedTemplate(eventId)?.groups ?? [])
    }
    syncLocked()
    window.addEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
    return () => window.removeEventListener(LOCKED_TEMPLATE_CHANGED, syncLocked)
  }, [eventId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: fetchError } = await supabase
        .from('groups')
        .select('*, participant_groups(count)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      const mapped: GroupWithCount[] = (data ?? []).map((g) => ({
        ...g,
        member_count: (g.participant_groups as unknown as { count: number }[])?.[0]?.count ?? 0,
      }))

      setGroups(mapped)
      onCountChange(mapped.length)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (groups.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
    prevCountRef.current = groups.length
  }, [groups.length])

  function handleAdded(group: Group) {
    setGroups((prev) => {
      const next = [...prev, { ...group, member_count: 0 }]
      onCountChange(next.length)
      return next
    })
  }

  function handleSaved(saved: Group) {
    handleFormClose()
    setGroups((prev) => {
      const exists = prev.some((g) => g.id === saved.id)
      if (exists) {
        return prev.map((g) => (
          g.id === saved.id ? { ...g, ...saved } : g
        ))
      }
      const next = [...prev, { ...saved, member_count: 0 }]
      onCountChange(next.length)
      return next
    })
  }

  function handleEdit(group: GroupWithCount) {
    setEditingGroup(group)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingGroup(null)
  }

  async function handleDelete() {
    if (!deletingGroup) return
    const deletedId = deletingGroup.id
    setDeleting(true)

    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', deletedId)

    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      setDeletingGroup(null)
      return
    }

    setDeletingGroup(null)
    setGroups((prev) => {
      const next = prev.filter((g) => g.id !== deletedId)
      onCountChange(next.length)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    )
  }

  const hasLocked = lockedGroups.length > 0

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 mb-4 flex items-center">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20">
            <Layers size={18} className="text-brand-400" />
          </div>
          <h2 className="text-lg font-bold text-white">קבוצות</h2>
        </div>
      </div>

      {error && (
        <ErrorAlert message={error} className="mb-4" />
      )}

      {groups.length === 0 && !hasLocked ? (
        <EmptyState
          title="אין קבוצות עדיין"
          description="הקלד שם קבוצה למטה ולחץ Enter"
        />
      ) : (
        <div ref={listRef} className="flex-1 overflow-y-auto min-h-0 space-y-3">
          {groups.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onEdit={() => handleEdit(group)}
                  onDelete={() => setDeletingGroup(group)}
                />
              ))}
            </div>
          )}

          {hasLocked && (
            <>
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-white/10" />
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                  <Lock size={10} />
                  פרמיום
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {lockedGroups.map((group) => (
                  <LockedGroupCard key={group.id} group={group} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="shrink-0 pt-3">
        <InlineAddGroup eventId={eventId} onAdded={handleAdded} onPlanLimit={() => setUpgradeOpen(true)} />
      </div>

      {formOpen && (
        <GroupForm
          eventId={eventId}
          group={editingGroup ?? undefined}
          isOpen={formOpen}
          onClose={handleFormClose}
          onSaved={handleSaved}
        />
      )}

      <Modal
        isOpen={!!deletingGroup}
        onClose={() => setDeletingGroup(null)}
        title="מחיקת קבוצה"
      >
        <p className="text-sm text-gray-400">
          האם אתם בטוחים שברצונכם למחוק את <strong>{deletingGroup?.name}</strong>?
          כל שיוכי המשתתפים לקבוצה זו יוסרו גם כן. לא ניתן לבטל פעולה זו.
        </p>
        <div className="mt-4 flex gap-3">
          <Button variant="danger" loading={deleting} onClick={handleDelete}>
            מחיקה
          </Button>
          <Button variant="outline" onClick={() => setDeletingGroup(null)}>
            ביטול
          </Button>
        </div>
      </Modal>

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  )
}
