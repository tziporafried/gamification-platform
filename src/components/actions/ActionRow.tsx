import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { ActionWithGroups, Group } from '@/types'

interface ActionRowProps {
  action: ActionWithGroups
  groups: Group[]
  onEdit: () => void
  onToggleActive: () => void
  onDeleted?: () => void
}

export function ActionRow({ action, groups, onToggleActive, onDeleted }: ActionRowProps) {
  const [editingName, setEditingName] = useState(false)
  const [editingPoints, setEditingPoints] = useState(false)
  const [name, setName] = useState(action.name)
  const [points, setPoints] = useState(action.points.toString())
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const pointsRef = useRef<HTMLInputElement>(null)

  const isPositive = action.points >= 0
  const assignedGroupIds = new Set(action.groups.map(g => g.id))
  const isAllGroups = action.groups.length === 0

  useEffect(() => { setName(action.name) }, [action.name])
  useEffect(() => { setPoints(action.points.toString()) }, [action.points])

  useEffect(() => {
    if (editingName) { nameRef.current?.focus(); nameRef.current?.select() }
  }, [editingName])

  useEffect(() => {
    if (editingPoints) { pointsRef.current?.focus(); pointsRef.current?.select() }
  }, [editingPoints])

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === action.name) {
      setName(action.name)
      setEditingName(false)
      return
    }
    setSaving(true)
    await supabase.from('actions').update({ name: trimmed }).eq('id', action.id)
    setSaving(false)
    setEditingName(false)
  }

  async function savePoints() {
    const num = parseInt(points, 10)
    if (isNaN(num) || num === action.points) {
      setPoints(action.points.toString())
      setEditingPoints(false)
      return
    }
    setSaving(true)
    await supabase.from('actions').update({ points: num }).eq('id', action.id)
    setSaving(false)
    setEditingPoints(false)
  }

  function handleNameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); saveName() }
    if (e.key === 'Escape') { setName(action.name); setEditingName(false) }
  }

  function handlePointsKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); savePoints() }
    if (e.key === 'Escape') { setPoints(action.points.toString()); setEditingPoints(false) }
  }

  async function handleDelete() {
    if (!onDeleted) return
    await supabase.from('actions').update({ is_active: false }).eq('id', action.id)
    onDeleted()
  }

  async function toggleGroup(groupId: string) {
    const isMember = assignedGroupIds.has(groupId)
    if (isMember) {
      await supabase.from('action_groups').delete().eq('action_id', action.id).eq('group_id', groupId)
    } else {
      await supabase.from('action_groups').insert({ action_id: action.id, group_id: groupId })
    }
    if (onDeleted) onDeleted() // triggers refetch
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-game-card px-4 py-3 transition-all duration-200 hover:border-brand-700/50 group/row',
        !action.is_active && 'opacity-50',
        isPositive ? 'border-game-border' : 'border-red-500/20',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Points badge */}
        {editingPoints ? (
          <input
            ref={pointsRef}
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            onKeyDown={handlePointsKey}
            onBlur={savePoints}
            className={cn(
              'h-11 w-11 rounded-xl text-center text-sm font-bold outline-none border border-brand-500 bg-game-dark text-white',
              saving && 'opacity-50',
            )}
            disabled={saving}
          />
        ) : (
          <button
            onClick={() => setEditingPoints(true)}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold cursor-text transition-colors',
              isPositive
                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
            )}
          >
            {isPositive ? '+' : ''}{action.points}
          </button>
        )}

        {/* Name */}
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleNameKey}
              onBlur={saveName}
              className={cn(
                'w-full bg-transparent text-sm font-semibold text-white outline-none border-b border-brand-500 pb-0.5',
                saving && 'opacity-50',
              )}
              disabled={saving}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="truncate text-sm font-semibold text-gray-200 hover:text-white transition-colors cursor-text text-right"
            >
              {action.name}
            </button>
          )}
        </div>

        {/* Status + delete */}
        <div className="flex shrink-0 items-center gap-1">
          {!action.is_active && (
            <span className="rounded-full bg-gray-600/50 px-2 py-0.5 text-[10px] font-medium text-gray-400">
              לא פעיל
            </span>
          )}
          <button
            onClick={onToggleActive}
            className={cn(
              'shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors',
              action.is_active
                ? 'text-gray-500 hover:bg-amber-500/10 hover:text-amber-400'
                : 'text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-300',
            )}
          >
            {action.is_active ? 'השבת' : 'הפעל'}
          </button>
          <button
            onClick={handleDelete}
            className="shrink-0 p-1.5 rounded-lg text-gray-600 opacity-0 group-hover/row:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
            title="מחיקה"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Group assignment (only if groups exist) */}
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 mr-14">
          <span className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
            isAllGroups ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-500',
          )}>
            {isAllGroups ? 'כל הקבוצות' : ''}
          </span>
          {groups.map((g) => {
            const isAssigned = assignedGroupIds.has(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggleGroup(g.id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all border',
                  isAssigned
                    ? 'border-transparent text-white'
                    : 'border-dashed border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300',
                )}
                style={isAssigned ? { backgroundColor: g.color + '33', color: g.color } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: isAssigned ? g.color : undefined }}
                />
                {g.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
