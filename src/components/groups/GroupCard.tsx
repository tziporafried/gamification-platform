import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Users, Trash2, Palette } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { GroupWithCount } from '@/types'

interface GroupCardProps {
  group: GroupWithCount
  onEdit: () => void
  onDelete: () => void
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
]

export function GroupCard({ group, onDelete }: GroupCardProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color)
  const [saving, setSaving] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const colorRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setName(group.name) }, [group.name])
  useEffect(() => { setColor(group.color) }, [group.color])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  useEffect(() => {
    if (!showColorPicker) return
    function handleClickOutside(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColorPicker])

  async function saveEdit() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === group.name) {
      setName(group.name)
      setEditing(false)
      return
    }

    setSaving(true)
    await supabase.from('groups').update({ name: trimmed }).eq('id', group.id)
    setSaving(false)
    setEditing(false)
  }

  async function changeColor(newColor: string) {
    setColor(newColor)
    setShowColorPicker(false)
    await supabase.from('groups').update({ color: newColor }).eq('id', group.id)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
    if (e.key === 'Escape') { setName(group.name); setEditing(false) }
  }

  return (
    <Card variant="interactive" className="group/card">
      <div
        className="h-1.5 w-full rounded-t-xl transition-colors"
        style={{ backgroundColor: color }}
      />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Color dot + picker */}
            <div className="relative" ref={colorRef}>
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-transparent hover:border-white/30 transition-all"
                style={{ backgroundColor: color }}
                title="שנה צבע"
              >
                <Palette size={12} className="text-white/70" />
              </button>

              {showColorPicker && (
                <div className="absolute top-full mt-2 right-0 z-50 rounded-xl border border-game-border bg-game-card p-3 shadow-podium animate-scale-in">
                  <div className="flex gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => changeColor(c)}
                        className={cn(
                          'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                          color === c ? 'border-white scale-110' : 'border-transparent',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Name */}
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={saveEdit}
                  className={cn(
                    'w-full bg-transparent text-sm font-semibold text-white outline-none border-b border-brand-500 pb-0.5',
                    saving && 'opacity-50',
                  )}
                  disabled={saving}
                />
              ) : (
                <span
                  onClick={() => setEditing(true)}
                  className="block w-full font-semibold text-gray-200 hover:text-white transition-colors cursor-text text-right truncate"
                >
                  {name}
                </span>
              )}
            </div>

            {/* Member count */}
            <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
              <Users size={12} />
              <span>{group.member_count}</span>
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="shrink-0 p-1.5 rounded-lg text-gray-600 opacity-0 group-hover/card:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
            title="מחיקה"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </Card>
  )
}
