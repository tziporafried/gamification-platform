import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Action } from '@/types'

interface ActionRowProps {
  action: Action
  onEdit: () => void
  onToggleActive: () => void
  onDeleted?: () => void
}

export function ActionRow({ action, onToggleActive, onDeleted }: ActionRowProps) {
  const [editingName, setEditingName] = useState(false)
  const [editingPoints, setEditingPoints] = useState(false)
  const [name, setName] = useState(action.name)
  const [points, setPoints] = useState(action.points.toString())
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const pointsRef = useRef<HTMLInputElement>(null)

  const isPositive = action.points >= 0

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

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-game-card px-4 py-3 transition-all duration-200 hover:border-brand-700/50 group',
        !action.is_active && 'opacity-50',
        isPositive ? 'border-game-border' : 'border-red-500/20',
      )}
    >
      {/* Points badge — click to edit */}
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

      {/* Name — click to edit */}
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
          <div>
            <button
              onClick={() => setEditingName(true)}
              className="truncate text-sm font-semibold text-gray-200 hover:text-white transition-colors cursor-text text-right"
            >
              {action.name}
            </button>
            {action.description && (
              <p className="mt-0.5 truncate text-xs text-gray-500">{action.description}</p>
            )}
          </div>
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
          className="shrink-0 p-1.5 rounded-lg text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
          title="מחיקה"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
