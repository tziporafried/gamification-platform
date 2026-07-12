import { useState, useRef, useEffect, useCallback, useLayoutEffect, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Users, Palette } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { WizardDeleteButton } from '@/components/wizard/WizardDeleteButton'
import { Tooltip, useIsTruncated } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { getPanelLeftAlignedToTriggerRight, positionFloatingPanel } from '@/lib/floatingPanel'
import { isPresetColor } from '@/lib/paletteColors'
import type { GroupWithCount } from '@/types'

interface GroupCardProps {
  group: GroupWithCount
  onEdit: () => void
  onDelete: () => void
}

const VIEWPORT_PADDING = 8
const PANEL_GAP = 6

function getGroupCardStyle(color: string): React.CSSProperties {
  return { backgroundColor: color }
}

export function GroupCard({ group, onDelete }: GroupCardProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color)
  const [saving, setSaving] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nameTextRef = useRef<HTMLParagraphElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const isNameTruncated = useIsTruncated(nameTextRef, name)
  const memberLabel = group.member_count === 1 ? 'משתתף' : 'משתתפים'

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
    const panel = panelRef.current
    if (!rect || !panel) return

    const width = panel.offsetWidth || 300
    const height = panel.offsetHeight || 48

    const { top, left } = positionFloatingPanel(
      rect,
      { width, height },
      { gap: PANEL_GAP, viewportPadding: VIEWPORT_PADDING },
    )
    setPanelStyle({ top, left })

    // Keep wizard scrollports from shifting sideways when the swatch is focused.
    let node: HTMLElement | null = buttonRef.current
    while (node) {
      if (node.scrollLeft) node.scrollLeft = 0
      node = node.parentElement
    }
  }, [])

  useLayoutEffect(() => {
    if (!showColorPicker) {
      setPanelStyle(null)
      return
    }
    updatePanelPosition()
    const frame = requestAnimationFrame(() => updatePanelPosition())
    return () => cancelAnimationFrame(frame)
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
    <div className="group/card relative h-full">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-card-hover hover:brightness-[1.03] motion-reduce:hover:transform-none motion-reduce:hover:brightness-100',
        )}
        style={getGroupCardStyle(color)}
      >
        <div className="relative z-10 flex min-h-[8.5rem] flex-col items-center justify-center gap-1.5 px-4 py-5 text-center">
          <Users
            size={16}
            strokeWidth={2}
            className="pointer-events-none shrink-0 text-white/80"
          />

          <Tooltip
            content={name}
            hidden={editing || !isNameTruncated}
            className="w-full"
          >
            <div
              className="flex h-9 w-full min-w-0 items-center justify-center"
              onClick={() => !editing && setEditing(true)}
              role="button"
              tabIndex={-1}
            >
              {editing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={saveEdit}
                  disabled={saving}
                  className={cn(
                    'h-full w-full min-w-0 bg-transparent text-center text-xl font-bold text-white outline-none border-0 border-b border-white/50',
                    saving && 'opacity-50',
                  )}
                />
              ) : (
                <p
                  ref={nameTextRef}
                  className="w-full min-w-0 truncate text-xl font-bold leading-9 cursor-text hover:text-white/90 transition-colors"
                >
                  {name}
                </p>
              )}
            </div>
          </Tooltip>

          <div className="inline-flex h-7 items-center justify-center rounded-full bg-white/20 px-3 text-xs font-bold">
            {group.member_count.toLocaleString()} {memberLabel}
          </div>
        </div>

        <div className="absolute right-2 top-2 z-20">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => {
              setShowColorPicker((prev) => {
                const next = !prev
                if (!next) {
                  setPanelStyle(null)
                  return next
                }
                const rect = buttonRef.current?.getBoundingClientRect()
                if (rect) {
                  setPanelStyle({
                    top: rect.bottom + PANEL_GAP,
                    left: getPanelLeftAlignedToTriggerRight(rect.right, 300, VIEWPORT_PADDING),
                  })
                }
                return next
              })
            }}
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-white/35 transition-opacity hover:opacity-90"
            style={{ backgroundColor: color }}
            title="שנה צבע"
          >
            <Palette size={11} className="text-white drop-shadow-sm" />
          </button>

          {showColorPicker && createPortal(
            <div
              ref={panelRef}
              style={{
                position: 'fixed',
                top: panelStyle?.top ?? -9999,
                left: panelStyle?.left ?? 0,
                visibility: panelStyle ? 'visible' : 'hidden',
              }}
              className="z-[200] w-max rounded-xl border border-border bg-surface p-3 shadow-podium animate-scale-in"
              data-testid="group-color-panel"
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

        <WizardDeleteButton variant="card" onClick={onDelete} />
      </div>
    </div>
  )
}
