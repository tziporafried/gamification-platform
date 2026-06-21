import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { ParticipantWithGroups } from '@/types'

interface ParticipantRowProps {
  participant: ParticipantWithGroups
  onEdit: () => void
  onDelete: () => void
  onManageGroups: () => void
}

export function ParticipantRow({ participant, onDelete, onManageGroups }: ParticipantRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(participant.name)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  async function saveEdit() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === participant.name) {
      setName(participant.name)
      setEditing(false)
      return
    }

    setSaving(true)
    await supabase.from('participants').update({ name: trimmed }).eq('id', participant.id)
    setSaving(false)
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
    if (e.key === 'Escape') { setName(participant.name); setEditing(false) }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-game-border bg-game-card p-3 transition-all duration-200 hover:border-brand-700/50 group">
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
          <button
            onClick={() => setEditing(true)}
            className="font-semibold text-gray-200 truncate text-right hover:text-white transition-colors cursor-text"
          >
            {participant.name}
          </button>
        )}
        {participant.groups.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {participant.groups.map((g) => (
              <button key={g.id} onClick={onManageGroups}>
                <Badge label={g.name} color={g.color} />
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onDelete}
        className="shrink-0 p-1.5 rounded-lg text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
        title="מחיקה"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}
