import { useState } from 'react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { Input } from '@/components/ui/Input'
import type { Event } from '@/types'
import { supabase } from '@/lib/supabase'

interface StepEventDetailsProps {
  event: Event
  onEventUpdated: (event: Event) => void
  onNext: () => void
}

export function StepEventDetails({ event, onEventUpdated, onNext }: StepEventDetailsProps) {
  const [name, setName] = useState(event.name || '')
  const [saving, setSaving] = useState(false)

  const canAdvance = name.trim().length > 0

  async function handleNext() {
    if (!canAdvance) return
    if (name !== event.name) {
      setSaving(true)
      const { data } = await supabase
        .from('events')
        .update({ name: name.trim() })
        .eq('id', event.id)
        .select()
        .single()
      setSaving(false)
      if (data) onEventUpdated(data)
    }
    onNext()
  }

  return (
    <WizardStepWrapper
      title="פרטי האירוע"
      subtitle="תן שם לאירוע שלך"
      currentStep={1}
      canAdvance={canAdvance}
      onNext={handleNext}
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            שם האירוע
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="למשל: חופשה משפחתית 2026"
            className="text-lg"
            autoFocus
            disabled={saving}
          />
        </div>
      </div>
    </WizardStepWrapper>
  )
}
