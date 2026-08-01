import { useState, useRef, useEffect, useCallback, useLayoutEffect, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Users, Palette, Trophy, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { WizardDeleteButton } from '@/components/wizard/WizardDeleteButton'
import { Tooltip, useIsTruncated } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { getPanelLeftAlignedToTriggerRight, positionFloatingPanel } from '@/lib/floatingPanel'
import { isPresetColor } from '@/lib/paletteColors'
import {
  GROUP_PURPOSE_DESCRIPTIONS,
  GROUP_PURPOSE_LABELS,
  groupPurpose,
  isMissingGroupPurposeError,
  MISSING_GROUP_PURPOSE_MESSAGE,
} from '@/lib/groups/groupPurpose'
import type { GroupPurpose, GroupWithCount } from '@/types'

interface GroupCardProps {
  group: GroupWithCount
  onEdit: () => void
  onDelete: () => void
  /** The `group_purpose` flag is on: the card says what the group is for, and can change it. */
  showPurpose?: boolean
  /** Saved - so the list, and the wizard's count of who competes, keep up. */
  onPurposeChange?: (purpose: GroupPurpose) => void
  /** Migration 090 has not been applied, so the choice could not be stored. */
  onPurposeError?: (message: string) => void
}

const VIEWPORT_PADDING = 8
const PANEL_GAP = 6

function getGroupCardStyle(color: string): React.CSSProperties {
  return { backgroundColor: color }
}

export function GroupCard({
  group,
  onDelete,
  showPurpose = false,
  onPurposeChange,
  onPurposeError,
}: GroupCardProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color)
  const [purpose, setPurpose] = useState<GroupPurpose>(groupPurpose(group))
  const [saving, setSaving] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nameTextRef = useRef<HTMLButtonElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const isNameTruncated = useIsTruncated(nameTextRef, name)
  const memberLabel = group.member_count === 1 ? 'משתתף' : 'משתתפים'

  useEffect(() => { setName(group.name) }, [group.name])
  useEffect(() => { setColor(group.color) }, [group.color])
  useEffect(() => { setPurpose(groupPurpose(group)) }, [group.purpose]) // eslint-disable-line react-hooks/exhaustive-deps

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

  /**
   * Optimistic, like the colour above: the pill is a statement about what the
   * group is for, and a round trip before it flips reads as a dead control. A
   * failed write puts it back and says why.
   */
  async function togglePurpose() {
    const next: GroupPurpose = purpose === 'distribution' ? 'competition' : 'distribution'
    setPurpose(next)
    onPurposeChange?.(next)

    const { error } = await supabase.from('groups').update({ purpose: next }).eq('id', group.id)
    if (!error) return

    setPurpose(purpose)
    onPurposeChange?.(purpose)
    onPurposeError?.(
      isMissingGroupPurposeError(error.message) ? MISSING_GROUP_PURPOSE_MESSAGE : error.message,
    )
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
            {/* Real button when idle - role="button" with tabIndex={-1}
                announced a control keyboard users could not reach. */}
            <div className="flex h-9 w-full min-w-0 items-center justify-center">
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
                <button
                  ref={nameTextRef}
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label={`עריכת שם הקבוצה: ${name}`}
                  className="w-full min-w-0 truncate border-0 bg-transparent p-0 text-xl font-bold leading-9 cursor-text hover:text-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  {name}
                </button>
              )}
            </div>
          </Tooltip>

          <div className="inline-flex h-7 items-center justify-center rounded-full bg-white/20 px-3 text-xs font-bold">
            {group.member_count.toLocaleString()} {memberLabel}
          </div>

          {/* Both states are shown, not just the unusual one: the pill is the
              control that changes it, and a badge that appears only on half the
              cards would leave the other half with nothing to press.
              Portalled, because the card clips its own overflow. */}
          {showPurpose && (
            <Tooltip portal rich content={GROUP_PURPOSE_DESCRIPTIONS[purpose]}>
              <button
                type="button"
                onClick={togglePurpose}
                aria-label={`${GROUP_PURPOSE_LABELS[purpose]} - לחצו כדי להחליף`}
                className={cn(
                  'inline-flex h-6 items-center justify-center gap-1 rounded-full border px-2.5 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
                  purpose === 'distribution'
                    ? 'border-white/70 bg-white/85 text-neutral-900 hover:bg-white'
                    : 'border-white/40 bg-transparent text-white/90 hover:bg-white/20',
                )}
              >
                {purpose === 'distribution'
                  ? <Share2 size={11} strokeWidth={2.5} className="shrink-0" />
                  : <Trophy size={11} strokeWidth={2.5} className="shrink-0" />}
                {GROUP_PURPOSE_LABELS[purpose]}
              </button>
            </Tooltip>
          )}
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
