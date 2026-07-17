import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

/**
 * Exposes the built offline player as `virtual:offline-player-template`, a raw
 * string the exporter injects event data into before download.
 *
 * The template is the output of `npm run build:offline`. If it hasn't been built
 * yet (e.g. a fresh dev server), this resolves to an empty string and the export
 * button reports that the player needs building — dev never crashes over it.
 */
function offlinePlayerTemplate(): Plugin {
  const virtualId = 'virtual:offline-player-template'
  const resolvedId = '\0' + virtualId
  const templatePath = fileURLToPath(
    new URL('./dist-offline/player-template.tpl', import.meta.url),
  )

  return {
    name: 'offline-player-template',
    enforce: 'pre',
    resolveId(id) {
      if (id === virtualId) return resolvedId
    },
    load(id) {
      if (id !== resolvedId) return
      let template = ''
      try {
        template = readFileSync(templatePath, 'utf8')
      } catch {
        this.warn('Offline player template not found — run `npm run build:offline`.')
      }
      return `export default ${JSON.stringify(template)}`
    },
  }
}

export default defineConfig({
  plugins: [react(), offlinePlayerTemplate()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
