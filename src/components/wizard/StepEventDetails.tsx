import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { WizardStepWrapper } from './WizardStepWrapper'
import { Input } from '@/components/ui/Input'
import { ColorPicker } from '@/components/ui/ColorPicker'
import type { Event } from '@/types'
import { supabase } from '@/lib/supabase'

interface StepEventDetailsProps {
  event: Event
  onEventUpdated: (event: Event) => void
  onNext: () => void
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export function StepEventDetails({ event, onEventUpdated, onNext }: StepEventDetailsProps) {
  const [name, setName] = useState(event.name || '')
  const [themeColor, setThemeColor] = useState(event.theme_color || '#6366f1')
  const [logoUrl, setLogoUrl] = useState<string | null>(event.logo_url)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(event.logo_url)
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canAdvance = name.trim().length > 0

  function handleFileSelect(file: File) {
    setUploadError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError('פורמט לא נתמך. השתמש ב-PNG, JPG, WebP או SVG')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('הקובץ גדול מדי. מקסימום 2MB')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  function handleRemoveLogo() {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoUrl(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile) return logoUrl
    const ext = logoFile.name.split('.').pop() || 'png'
    const path = `${event.id}/logo.${ext}`

    const { error } = await supabase.storage
      .from('event-logos')
      .upload(path, logoFile, { upsert: true })

    if (error) {
      setUploadError('שגיאה בהעלאת הלוגו. נסה שוב')
      return null
    }

    const { data: urlData } = supabase.storage
      .from('event-logos')
      .getPublicUrl(path)

    return urlData.publicUrl
  }

  async function handleNext() {
    if (!canAdvance) return
    setSaving(true)

    const hasChanges =
      name !== event.name ||
      themeColor !== event.theme_color ||
      logoFile !== null ||
      logoUrl !== event.logo_url

    if (hasChanges) {
      let newLogoUrl = logoUrl
      if (logoFile) {
        newLogoUrl = await uploadLogo()
        if (newLogoUrl === null && logoFile) {
          setSaving(false)
          return
        }
      }

      const { data } = await supabase
        .from('events')
        .update({
          name: name.trim(),
          theme_color: themeColor,
          logo_url: newLogoUrl,
        })
        .eq('id', event.id)
        .select()
        .single()

      setSaving(false)
      if (data) onEventUpdated(data)
    } else {
      setSaving(false)
    }
    onNext()
  }

  return (
    <WizardStepWrapper
      title="פרטי האירוע"
      subtitle="הגדר את שם האירוע, צבעי המותג והלוגו"
      currentStep={1}
      canAdvance={canAdvance && !saving}
      onNext={handleNext}
    >
      <div className="space-y-6">
        {/* Event name + brand color on same row */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
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
          <div className="shrink-0 pb-0.5">
            <ColorPicker
              label="צבע מותג"
              value={themeColor}
              onChange={setThemeColor}
            />
          </div>
        </div>

        {/* Logo upload */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            לוגו האירוע
          </label>

          {logoPreview ? (
            <div className="relative inline-block">
              <div
                className="w-28 h-28 rounded-xl border-2 border-game-border bg-game-card flex items-center justify-center overflow-hidden"
                style={{ borderColor: themeColor + '40' }}
              >
                <img
                  src={logoPreview}
                  alt="לוגו האירוע"
                  className="max-w-full max-h-full object-contain p-2"
                />
              </div>
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-sm border-2 border-dashed border-game-border rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-brand-500/50 hover:bg-brand-500/5 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center">
                <ImageIcon size={24} className="text-brand-400" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-300">
                  גרור לוגו לכאן או{' '}
                  <span className="text-brand-400 underline underline-offset-2">בחר קובץ</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, WebP או SVG • עד 2MB
                </p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
          />

          {uploadError && (
            <p className="mt-2 text-sm text-red-400">{uploadError}</p>
          )}
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-game-border bg-game-card/50 p-4">
          <p className="text-xs text-gray-500 mb-3">תצוגה מקדימה</p>
          <div className="flex items-center gap-3">
            {logoPreview ? (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
                style={{ backgroundColor: themeColor + '20', borderColor: themeColor + '40', borderWidth: 1 }}
              >
                <img src={logoPreview} alt="" className="max-w-full max-h-full object-contain p-0.5" />
              </div>
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: themeColor + '20' }}
              >
                <Upload size={18} style={{ color: themeColor }} />
              </div>
            )}
            <div>
              <p className="text-white font-semibold text-sm leading-tight">
                {name || 'שם האירוע'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeColor }} />
                <span className="text-xs text-gray-500">צבע מותג</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WizardStepWrapper>
  )
}
