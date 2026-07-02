import { useState, useRef, useEffect, useCallback, useLayoutEffect, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Users, Palette } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { DeleteButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/utils'
import { isPresetColor } from '@/lib/paletteColors'
import type { GroupWithCount } from '@/types'

interface GroupCardProps {
  group: GroupWithCount
  onEdit: () => void
  onDelete: () => void
}

const COLOR_PANEL_WIDTH = 288

function clampPanelLeft(triggerLeft: number) {
  return Math.max(8, Math.min(triggerLeft, window.innerWidth - COLOR_PANEL_WIDTH - 8))
}

export function GroupCard({ group, onDelete }: GroupCardProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color)
  const [saving, setSaving] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setName(group.name) }, [group.name])
  useEffect(() => { setColor(group.color) }, [group.color])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const updatePanelPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setPanelStyle({
      top: rect.bottom + 6,
      left: clampPanelLeft(rect.left),
    })
  }, [])

  useLayoutEffect(() => {
    if (!showColorPicker) {
      setPanelStyle(null)
      return
    }
    updatePanelPosition()
  }, [showColorPicker, updatePanelPosition])

  useEffect(() => {
    if (!showColorPicker) return

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setShowColorPicker(false)
    }

    function handleReposition() {
      updatePanelPosition()
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [showColorPicker, updatePanelPosition])

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

  async function changeColor(newColor: string, closePicker = false) {
    setColor(newColor)
    if (closePicker) setShowColorPicker(false)
    await supabase.from('groups').update({ color: newColor }).eq('id', group.id)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
    if (e.key === 'Escape') { setName(group.name); setEditing(false) }
  }

  return (
    <Card
      variant="interactive"
      className="group"
      style={{ '--group-color': color } as React.CSSProperties}
    >
      <div
        className="h-1.5 w-full rounded-t-xl transition-colors"
        style={{ backgroundColor: color }}
      />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Color dot + picker */}
            <div className="relative">
              <button
                ref={buttonRef}
                onClick={() => setShowColorPicker((prev) => !prev)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-transparent hover:border-border transition-all"
                style={{ backgroundColor: color }}
                title="שנה צבע"
              >
                <Palette size={12} className="text-foreground/70" />
              </button>

              {showColorPicker && panelStyle && createPortal(
                <div
                  ref={panelRef}
                  style={{ position: 'fixed', top: panelStyle.top, left: panelStyle.left }}
                  className="z-[200] w-max rounded-xl border border-border bg-surface p-3 shadow-podium animate-scale-in"
                >
                  <ColorPicker
                    compact
                    value={color}
                    onChange={(c) => changeColor(c, isPresetColor(c))}
                  />
                </div>,
                document.body,
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
                    'w-full bg-transparent text-sm font-semibold text-foreground outline-none border-b border-secondary pb-0.5',
                    saving && 'opacity-50',
                  )}
                  disabled={saving}
                />
              ) : (
                <span
                  onClick={() => setEditing(true)}
                  className="block w-full font-semibold text-foreground hover:text-secondary transition-colors cursor-text text-right truncate"
                >
                  {name}
                </span>
              )}
            </div>

            {/* Member count */}
            <div className="flex items-center gap-1 text-xs text-muted shrink-0">
              <Users size={12} />
              <span>{group.member_count}</span>
            </div>
          </div>

          {/* Delete */}
          <DeleteButton revealOnHover iconSize={14} onClick={onDelete} />
        </div>
      </div>
    </Card>
  )
}
