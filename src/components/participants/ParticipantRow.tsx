import { useState, useRef, useEffect, memo, KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { WizardDeleteButton } from '@/components/wizard/WizardDeleteButton'
import { cn } from '@/lib/utils'
import { GroupSelectDropdown } from '@/components/groups/GroupSelectDropdown'
import { Tooltip, useIsTruncated } from '@/components/ui/Tooltip'
import { PARTICIPANT_CARD_GRADIENT, getParticipantIcon, getParticipantIconMotion } from '@/lib/participantTiers'
import type { Group, ParticipantWithGroups } from '@/types'

interface ParticipantRowProps {
  participant: ParticipantWithGroups
  groups: Group[]
  allGroups: Group[]
  onDelete: (id: string) => void
  onToggleGroup: (participantId: string, groupId: string, isMember: boolean) => void
  onSelectAllGroups: (participantId: string, memberIds: Set<string>, allGroups: Group[]) => void
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
  const nameRef = useRef<HTMLInputElement>(null)
  const nameTextRef = useRef<HTMLParagraphElement>(null)

  const ParticipantIcon = getParticipantIcon(participant.id)
  const iconMotion = getParticipantIconMotion(participant.id)
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
        className={cn(
          'relative overflow-hidden rounded-xl text-warning-foreground transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:hover:transform-none',
          PARTICIPANT_CARD_GRADIENT,
        )}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
          <div className="absolute end-3 top-1/2 -translate-y-1/2">
            <ParticipantIcon
              size={44}
              strokeWidth={1.5}
              className="text-warning/25 animate-participant-icon-float motion-reduce:animate-none"
              style={{
                animationDelay: iconMotion.animationDelay,
                animationDuration: iconMotion.animationDuration,
              }}
            />
          </div>
        </div>

        <WizardDeleteButton
          variant="row"
          containerClassName="absolute left-2 top-1/2 z-20 -translate-y-1/2"
          fixedSize
          onClick={() => onDelete(participant.id)}
        />

        <div className="relative z-10 flex min-h-[3.25rem] items-center gap-2 py-2 pl-10 pr-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Tooltip
              content={name}
              hidden={editingName || !isNameTruncated}
              className="min-w-0 flex-1"
            >
              <div
                className="flex h-5 min-w-0 items-center"
                onClick={() => !editingName && setEditingName(true)}
                role="button"
                tabIndex={-1}
              >
                {editingName ? (
                  <input
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleNameKey}
                    onBlur={saveName}
                    className={cn(
                      'h-full w-full min-w-0 bg-transparent text-sm font-semibold leading-5 text-warning-foreground outline-none border-0 shadow-[inset_0_-1px_0_0_color-mix(in_srgb,var(--color-on-warning)_35%,transparent)]',
                      saving && 'opacity-50',
                    )}
                    disabled={saving}
                  />
                ) : (
                  <p
                    ref={nameTextRef}
                    className="h-full w-full min-w-0 truncate text-sm font-semibold leading-5 cursor-text hover:text-warning-foreground/80 transition-colors"
                  >
                    {name}
                  </p>
                )}
              </div>
            </Tooltip>

            {groups.length > 0 && (
              <div className="shrink-0">
                <GroupSelectDropdown
                  groups={groups}
                  selectedGroupIds={memberGroupIds}
                  allGroupsLabel="כל הקבוצות"
                  tooltip="לאילו קבוצות שייך המשתתף"
                  isAllSelected={isAllGroups}
                  onSelectAll={() => onSelectAllGroups(participant.id, memberGroupIds, allGroups)}
                  onToggleGroup={(groupId, isMember) => onToggleGroup(participant.id, groupId, isMember)}
                  tone="default"
                  size="compact"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
