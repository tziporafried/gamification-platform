import { useState, useRef, useEffect, memo, KeyboardEvent } from 'react'
import { Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { WizardDeleteButton } from '@/components/wizard/WizardDeleteButton'
import { cn } from '@/lib/utils'
import { GroupSelectDropdown } from '@/components/groups/GroupSelectDropdown'
import { Tooltip, useIsTruncated } from '@/components/ui/Tooltip'
import { PARTICIPANT_CARD_GRADIENT, getParticipantIcon } from '@/lib/participantTiers'
import { theme } from '@/lib/theme'
import { formatPhone, parsePhone, PHONE_ERROR_LABELS } from '@/lib/phone'
import { isMissingPhoneColumnError, MISSING_PHONE_COLUMN_MESSAGE } from '@/lib/smsNotifications'
import { isMissingNamePartsColumnError, MISSING_NAME_PARTS_COLUMN_MESSAGE } from '@/lib/roster/importCsvFlag'
import type { Group, ParticipantWithGroups } from '@/types'

interface ParticipantRowProps {
  participant: ParticipantWithGroups
  groups: Group[]
  allGroups: Group[]
  onDelete: (id: string) => void
  onToggleGroup: (participantId: string, groupId: string, isMember: boolean) => void
  onSelectAllGroups: (participantId: string, memberIds: Set<string>) => void
  onError?: (msg: string) => void
  /** The game texts its participants, so the row carries their number too. */
  collectPhone?: boolean
  onPhoneSaved?: (participantId: string, phone: string | null) => void
  /**
   * The game imported its roster, so these names came in already divided and
   * the editor has to keep them that way. Editing through one field would put
   * the whole name back into `first_name` and quietly drop every family name in
   * the event - see the UPDATE branch of the trigger in migration 083.
   */
  splitName?: boolean
  onNameSaved?: (participantId: string, firstName: string, lastName: string) => void
}

/** Shared by the one-field and two-field editors so both read as the same row. */
const NAME_INPUT_CLASS =
  'h-full w-full min-w-0 flex-1 bg-transparent text-sm font-semibold leading-5 tracking-tight text-[color-mix(in_srgb,var(--color-on-warning)_92%,#2e221e)] outline-none border-0 shadow-[inset_0_-1px_0_0_color-mix(in_srgb,var(--color-on-warning)_35%,transparent)] placeholder:font-normal placeholder:text-[color-mix(in_srgb,var(--color-on-warning)_45%,transparent)]'

export const ParticipantRow = memo(function ParticipantRow({
  participant,
  groups,
  allGroups,
  onDelete,
  onToggleGroup,
  onSelectAllGroups,
  onError,
  collectPhone = false,
  onPhoneSaved,
  splitName = false,
  onNameSaved,
}: ParticipantRowProps) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(participant.name)
  // Only edited when splitName is on. Falling back to the whole name covers the
  // row of a participant created before migration 083 backfilled the parts.
  const [firstName, setFirstName] = useState(participant.first_name ?? participant.name)
  const [lastName, setLastName] = useState(participant.last_name ?? '')
  const [saving, setSaving] = useState(false)
  const [touchRevealed, setTouchRevealed] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phone, setPhone] = useState(formatPhone(participant.phone))
  const [savingPhone, setSavingPhone] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const lastNameRef = useRef<HTMLInputElement>(null)
  const nameTextRef = useRef<HTMLButtonElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const ParticipantIcon = getParticipantIcon(participant.id)
  const memberGroupIds = new Set(participant.groups.map((g) => g.id))
  const isAllGroups = allGroups.length > 0 && allGroups.every((g) => memberGroupIds.has(g.id))
  const isNameTruncated = useIsTruncated(nameTextRef, name)

  useEffect(() => { setName(participant.name) }, [participant.name])
  useEffect(() => {
    setFirstName(participant.first_name ?? participant.name)
    setLastName(participant.last_name ?? '')
  }, [participant.first_name, participant.last_name, participant.name])
  useEffect(() => { setPhone(formatPhone(participant.phone)) }, [participant.phone])

  useEffect(() => {
    if (editingName) {
      nameRef.current?.focus()
      nameRef.current?.select()
    }
  }, [editingName])

  useEffect(() => {
    if (editingPhone) {
      phoneRef.current?.focus()
      phoneRef.current?.select()
    }
  }, [editingPhone])

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

  function resetName() {
    setName(participant.name)
    setFirstName(participant.first_name ?? participant.name)
    setLastName(participant.last_name ?? '')
    setEditingName(false)
  }

  /**
   * Two shapes of write, because there are two shapes of game.
   *
   * With the import, the parts are what the row edits and what it sends; the
   * database derives the joined name from them. Without it, the single field
   * writes `name` exactly as this row always has - the trigger takes the whole
   * of it as the first name, which is the same rule the typed add field
   * follows, and a database still missing migration 083 keeps working.
   */
  async function saveName() {
    if (splitName) return saveNameParts()

    const trimmed = name.trim()
    if (!trimmed || trimmed === participant.name) {
      resetName()
      return
    }
    setSaving(true)
    const { error } = await supabase.from('participants').update({ name: trimmed }).eq('id', participant.id)
    setSaving(false)
    if (error) {
      resetName()
      onError?.('שגיאה בעדכון שם המשתתף.')
      return
    }
    setEditingName(false)
  }

  async function saveNameParts() {
    const first = firstName.trim()
    const last = lastName.trim()
    // A family name alone is still somebody, so only a wholly empty pair is
    // refused - it would leave the row with no name at all.
    if (!first && !last) {
      resetName()
      return
    }
    if (first === (participant.first_name ?? '') && last === (participant.last_name ?? '')) {
      resetName()
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('participants')
      .update({ first_name: first, last_name: last })
      .eq('id', participant.id)
    setSaving(false)

    if (error) {
      resetName()
      onError?.(
        isMissingNamePartsColumnError(error.message)
          ? MISSING_NAME_PARTS_COLUMN_MESSAGE
          : 'שגיאה בעדכון שם המשתתף.',
      )
      return
    }

    setName(`${first} ${last}`.trim())
    setEditingName(false)
    onNameSaved?.(participant.id, first, last)
  }

  function handleNameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Enter on the first name moves to the family name rather than saving
      // half an edit, the same way the add field steps on to the phone.
      if (splitName && document.activeElement === nameRef.current) {
        lastNameRef.current?.focus()
        return
      }
      saveName()
    }
    if (e.key === 'Escape') resetName()
  }

  /**
   * Clearing the field removes the number, which is a real thing to want - a
   * participant who asked not to be texted. Anything else must be a number we
   * can send to.
   *
   * An unreadable one behaves differently depending on how the edit ended:
   * Enter means "this is what I meant", so the field stays open on the typed
   * digits with the reason shown. Clicking away means the edit is over, and
   * re-grabbing focus there would leave nowhere to click - so it says the same
   * thing and puts the stored number back.
   */
  async function savePhone(keepEditing = false) {
    const stored = participant.phone ?? null
    const typed = phone.trim()
    const parsed = parsePhone(typed)

    if (typed !== '' && !parsed.e164) {
      onError?.(PHONE_ERROR_LABELS[parsed.error!])
      if (keepEditing) {
        phoneRef.current?.focus()
        return
      }
      setPhone(formatPhone(stored))
      setEditingPhone(false)
      return
    }

    const next = parsed.e164
    if (next === stored) {
      setPhone(formatPhone(stored))
      setEditingPhone(false)
      return
    }

    setSavingPhone(true)
    const { error } = await supabase.from('participants').update({ phone: next }).eq('id', participant.id)
    setSavingPhone(false)

    if (error) {
      setPhone(formatPhone(stored))
      setEditingPhone(false)
      onError?.(isMissingPhoneColumnError(error.message)
        ? MISSING_PHONE_COLUMN_MESSAGE
        : 'שגיאה בעדכון מספר הטלפון.')
      return
    }

    setPhone(formatPhone(next))
    setEditingPhone(false)
    onPhoneSaved?.(participant.id, next)
  }

  function handlePhoneKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); savePhone(true) }
    if (e.key === 'Escape') { setPhone(formatPhone(participant.phone)); setEditingPhone(false) }
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
                  // Moving between the two halves is not the end of the edit, so
                  // the save hangs off the group and fires only when focus
                  // leaves it altogether.
                  <div
                    className="flex h-full min-w-0 flex-1 items-center gap-1.5"
                    onBlur={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
                      saveName()
                    }}
                  >
                    <input
                      ref={nameRef}
                      type="text"
                      value={splitName ? firstName : name}
                      onChange={(e) => (splitName ? setFirstName(e.target.value) : setName(e.target.value))}
                      onKeyDown={handleNameKey}
                      aria-label={splitName ? 'שם פרטי' : 'שם המשתתף'}
                      placeholder={splitName ? 'שם פרטי' : undefined}
                      className={cn(NAME_INPUT_CLASS, saving && 'opacity-50')}
                      disabled={saving}
                    />
                    {splitName && (
                      <input
                        ref={lastNameRef}
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        onKeyDown={handleNameKey}
                        aria-label="שם משפחה"
                        placeholder="שם משפחה"
                        className={cn(NAME_INPUT_CLASS, saving && 'opacity-50')}
                        disabled={saving}
                      />
                    )}
                  </div>
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

          {collectPhone && (
            <div className="flex shrink-0 items-center self-stretch">
              {editingPhone ? (
                <input
                  ref={phoneRef}
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={handlePhoneKey}
                  onBlur={() => savePhone()}
                  placeholder="050-1234567"
                  aria-label={`מספר הטלפון של ${name}`}
                  className={cn(
                    'h-7 w-32 rounded-md border-0 bg-white/25 px-2 text-xs font-semibold tabular-nums text-[color-mix(in_srgb,var(--color-on-warning)_92%,#2e221e)] outline-none placeholder:text-[color-mix(in_srgb,var(--color-on-warning)_45%,transparent)] focus-visible:ring-2 focus-visible:ring-white/80',
                    savingPhone && 'opacity-50',
                  )}
                  disabled={savingPhone}
                />
              ) : (
                // A missing number is the one thing this row exists to surface,
                // so it reads as an invitation to fill it in, not as blank space.
                <Tooltip content={participant.phone ? 'עריכת מספר הטלפון' : 'המשתתף לא יקבל הודעות SMS בלי מספר'}>
                  <button
                    type="button"
                    onClick={() => setEditingPhone(true)}
                    aria-label={participant.phone
                      ? `עריכת מספר הטלפון של ${name}: ${formatPhone(participant.phone)}`
                      : `הוספת מספר טלפון ל${name}`}
                    className={cn(
                      'inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
                      participant.phone
                        ? 'text-[color-mix(in_srgb,var(--color-on-warning)_78%,#2e221e)] hover:bg-white/20'
                        : 'border border-dashed border-white/45 text-[color-mix(in_srgb,var(--color-on-warning)_62%,#2e221e)] hover:bg-white/20',
                    )}
                  >
                    <Phone size={12} strokeWidth={2.25} aria-hidden="true" />
                    {participant.phone
                      ? <span dir="ltr">{formatPhone(participant.phone)}</span>
                      : 'הוסף טלפון'}
                  </button>
                </Tooltip>
              )}
            </div>
          )}

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
