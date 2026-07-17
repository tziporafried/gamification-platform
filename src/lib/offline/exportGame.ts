import playerTemplate from 'virtual:offline-player-template'
import { buildEventPack } from './pack'
import { injectPack, slugifyFileName } from './injectPack'

export { OfflineExportError } from './injectPack'

/**
 * Builds the pack for an event and downloads a self-contained game file.
 * Online-only: this reads from Supabase. The downloaded file needs no network.
 */
export async function exportOfflineGame(eventId: string): Promise<void> {
  const pack = await buildEventPack(eventId)
  const html = injectPack(playerTemplate, pack)

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = `${slugifyFileName(pack.event.name)}.html`
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
