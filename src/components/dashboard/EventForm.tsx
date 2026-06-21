import { useState, FormEvent, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { ColorPicker } from '@/components/ui/ColorPicker'
import type { Event, EventStatus } from '@/types'

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  finished: 'Finished',
  archived: 'Archived',
}

interface EventFormProps {
  event?: Event
  onSaved: (event: Event) => void
  onCancel?: () => void
}

export function EventForm({ event, onSaved, onCancel }: EventFormProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(event?.name ?? '')
  const [slug, setSlug] = useState(event?.slug ?? '')
  const [slugManual, setSlugManual] = useState(!!event)
  const [themeColor, setThemeColor] = useState(event?.theme_color ?? '#6366f1')
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'draft')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(event?.logo_url ?? null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = !!event

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManual) {
      setSlug(slugify(value))
    }
  }

  function handleSlugChange(value: string) {
    setSlugManual(true)
    setSlug(slugify(value))
  }

  function handleFileChange(file: File | null) {
    setLogoFile(file)
    if (file) {
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile) return event?.logo_url ?? null

    const ext = logoFile.name.split('.').pop()
    const path = `${user!.id}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('event-logos')
      .upload(path, logoFile, { upsert: true })

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('event-logos')
      .getPublicUrl(path)

    return data.publicUrl
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Event name is required.')
      return
    }
    if (!slug.trim()) {
      setError('Slug is required.')
      return
    }

    setSaving(true)

    try {
      const logoUrl = await uploadLogo()

      if (isEdit) {
        const { data, error: updateError } = await supabase
          .from('events')
          .update({
            name: name.trim(),
            slug: slug.trim(),
            theme_color: themeColor,
            status,
            logo_url: logoUrl,
          })
          .eq('id', event.id)
          .select()
          .single()

        if (updateError) throw updateError
        onSaved(data as Event)
      } else {
        const { data, error: insertError } = await supabase
          .from('events')
          .insert({
            owner_admin_id: user!.id,
            name: name.trim(),
            slug: slug.trim(),
            theme_color: themeColor,
            status,
            logo_url: logoUrl,
          })
          .select()
          .single()

        if (insertError) {
          if (insertError.code === '23505') {
            if (insertError.message.includes('slug')) {
              throw new Error('This slug is already taken. Please choose a different one.')
            }
            throw new Error('You already have an event.')
          }
          throw insertError
        }
        onSaved(data as Event)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-6 text-xl font-semibold text-white">
        {isEdit ? 'Edit Event' : 'Create Your Event'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-800/30 p-3 text-sm text-red-300">{error}</div>
        )}

        <Input
          id="name"
          label="Event Name"
          placeholder="My Awesome Event"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
        />

        <Input
          id="slug"
          label="Slug"
          placeholder="my-awesome-event"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
        />

        <ColorPicker
          label="Theme Color"
          value={themeColor}
          onChange={setThemeColor}
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Event Logo
          </label>
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-16 w-16 rounded-lg object-cover border border-game-border"
              />
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {logoPreview ? 'Change Logo' : 'Upload Logo'}
              </Button>
            </div>
          </div>
        </div>

        {isEdit && (
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className="block w-full rounded-xl border border-game-border bg-game-dark px-3 py-2 text-sm text-white shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" variant="gradient" loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Event'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}
