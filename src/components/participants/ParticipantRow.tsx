import { useState, useRef, useEffect, memo, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { WizardDeleteButton } from '@/components/wizard/WizardDeleteButton'
import { cn } from '@/lib/utils'
import { GroupSelectDropdown } from '@/components/groups/GroupSelectDropdown'
import { Tooltip, useIsTruncated } from '@/components/ui/Tooltip'
import { PARTICIPANT_CARD_GRADIENT, getParticipantIcon } from '@/lib/participantTiers'
import { theme } from '@/lib/theme'
import type { Group, ParticipantWithGroups } from '@/types'

interface ParticipantRowProps {
  participant: ParticipantWithGroups
  groups: Group[]
  allGroups: Group[]
  onDelete: (id: string) => void
  onToggleGroup: (participantId: string, groupId: string, isMember: boolean) => void
  onSelectAllGroups: (participantId: string, memberIds: Set<string>) => void
  onError?: (msg: string) => void
}

export const ParticipantRow = memo(function ParticipantRow({
  participant,
  groups,
  allGroups,
  onDelete,
  onToggleGroup,
  onSelectAllGroups,
  onError,
}: ParticipantRowProps) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(participant.name)
  const [saving, setSaving] = useState(false)
  const [touchRevealed, setTouchRevealed] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const nameTextRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const ParticipantIcon = getParticipantIcon(participant.id)
  const memberGroupIds = new Set(participant.groups.map((g) => g.id))
  const isAllGroups = allGroups.length > 0 && allGroups.every((g) => memberGroupIds.has(g.id))
  const isNameTruncated = useIsTruncated(nameTextRef, name)

  useEffect(() => { setName(participant.name) }, [participant.name])

  useEffect(() => {
    if (editingName) {
      nameRef.current?.focus()
      nameRef.current?.select()
    }
  }, [editingName])

  useEffect(() => {
    if (!touchRevealed) return

    function handlePointerDown(e: PointerEvent) {
      if (cardRef.current?.contains(e.target as Node)) return
      setTouchRevealed(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [touchRevealed])

  const showDeleteOnTouch = editingName || touchRevealed

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === participant.name) {
      setName(participant.name)
      setEditingName(false)
      return
    }
    setSaving(true)
    const { error } = await supabase.from('participants').update({ name: trimmed }).eq('id', participant.id)
    setSaving(false)
    if (error) {
      setName(participant.name)
      setEditingName(false)
      onError?.('שגיאה בעדכון שם המשתתף.')
      return
    }
    setEditingName(false)
  }

  function handleNameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); saveName() }
    if (e.key === 'Escape') { setName(participant.name); setEditingName(false) }
  }

  return (
    <div className="group/card relative">
      <div
        ref={cardRef}
        onPointerUp={(e) => {
          if (!window.matchMedia('(hover: none)').matches) return
          const target = e.target as HTMLElement
          if (target.closest('button') || target.closest('[role="button"]')) return
          setTouchRevealed(true)
        }}
        className={cn(
          'relative h-11 overflow-hidden rounded-xl cursor-pointer text-warning-foreground',
          theme.wizardListRowHover,
          PARTICIPANT_CARD_GRADIENT,
        )}
      >
        <WizardDeleteButton
          variant="card"
          containerClassName="absolute left-2 top-1/2 z-20 -translate-y-1/2"
          className={cn(
            '[@media(hover:none)]:!opacity-0',
            showDeleteOnTouch && '[@media(hover:none)]:!opacity-100',
          )}
          fixedSize
          onClick={() => onDelete(participant.id)}
        />

        <div className="relative z-10 flex h-11 items-center justify-between gap-1.5 py-0 pl-9 pr-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <ParticipantIcon
              size={14}
              strokeWidth={1.5}
              className="shrink-0 text-white/[0.22]"
              aria-hidden
            />

            <Tooltip
              content={name}
              hidden={editingName || !isNameTruncated}
              className="min-w-0 flex-1"
            >
              {/* Real button when idle - see GroupCard for the same fix. */}
              <div className="flex min-w-0 flex-1 items-center self-stretch cursor-text">
                {editingName ? (
                  <input
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleNameKey}
                    onBlur={saveName}
                    className={cn(
                      'h-full w-full min-w-0 bg-transparent text-sm font-semibold leading-5 tracking-tight text-[color-mix(in_srgb,var(--color-on-warning)_92%,#2e221e)] outline-none border-0 shadow-[inset_0_-1px_0_0_color-mix(in_srgb,var(--color-on-warning)_35%,transparent)]',
                      saving && 'opacity-50',
                    )}
                    disabled={saving}
                  />
                ) : (
                  <button
                    ref={nameTextRef}
                    type="button"
                    onClick={() => setEditingName(true)}
                    aria-label={`עריכת שם המשתתף: ${name}`}
                    className="w-full min-w-0 truncate border-0 bg-transparent p-0 text-right text-sm font-semibold leading-5 tracking-tight text-[color-mix(in_srgb,var(--color-on-warning)_92%,#2e221e)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  >
                    {name}
                  </button>
                )}
              </div>
            </Tooltip>
          </div>

          {groups.length > 0 && (
            <GroupSelectDropdown
              groups={groups}
              selectedGroupIds={memberGroupIds}
              allGroupsLabel="כל הקבוצות"
              tooltip="לאילו קבוצות שייך המשתתף"
              isAllSelected={isAllGroups}
              onSelectAll={() => onSelectAllGroups(participant.id, memberGroupIds)}
              onToggleGroup={(groupId, isMember) => onToggleGroup(participant.id, groupId, isMember)}
              tone="default"
              size="compact"
            />
          )}
        </div>
      </div>
    </div>
  )
})
