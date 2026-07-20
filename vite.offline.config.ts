import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * Inlines the Heebo webfont as @font-face data URIs so the offline player matches
 * the online app's typography. Runs at build time (which is online); if the fetch
 * fails, it warns and falls back to the system Hebrew stack - the build never breaks.
 */
function inlineHeebo(): Plugin {
  const CSS_URL =
    'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap'
  return {
    name: 'inline-heebo',
    async transform(code, id) {
      // Attach the @font-face rules to the app's global stylesheet.
      if (!id.includes('index.css')) return null
      try {
        const cssRes = await fetch(CSS_URL, {
          headers: {
            // Ask for woff2; a modern UA string makes Google return woff2 faces.
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
          },
        })
        let css = await cssRes.text()
        const urls = [...css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)].map((m) => m[1])
        const cache = new Map<string, string>()
        for (const url of urls) {
          if (cache.has(url)) continue
          const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
          cache.set(url, `data:font/woff2;base64,${buf.toString('base64')}`)
        }
        css = css.replace(/url\((https:\/\/[^)]+\.woff2)\)/g, (_m, u) => `url(${cache.get(u) ?? u})`)
        // eslint-disable-next-line no-console
        console.log(`[inline-heebo] embedded ${cache.size} Heebo font files`)
        return { code: css + '\n' + code, map: null }
      } catch (err) {
        this.warn(`[inline-heebo] could not fetch Heebo (${String(err)}); using system font fallback`)
        return null
      }
    },
  }
}

/**
 * Builds the standalone offline player into a single self-contained HTML file
 * that runs from file:// - no server, no network, no dependencies.
 *
 * Everything (JS, CSS, fonts, images) must end up inline: a file:// page cannot
 * fetch sibling assets, and external <script src> is blocked by CORS on opaque origins.
 */
function inlineSingleFile(): Plugin {
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return {
    name: 'inline-single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlKey = Object.keys(bundle).find((k) => k.endsWith('.html'))
      if (!htmlKey) return

      const htmlAsset = bundle[htmlKey]
      if (htmlAsset.type !== 'asset') return
      let html = String(htmlAsset.source)
      // Emitted as .tpl, not .html: Vite's dep scanner crawls every .html under
      // the project root - including build output - and chokes trying to resolve
      // bare imports out of already-bundled code. It ignores unknown extensions.
      delete bundle[htmlKey]

      for (const [key, chunk] of Object.entries(bundle)) {
        if (key === htmlKey) continue

        if (chunk.type === 'asset' && key.endsWith('.css')) {
          const css = String(chunk.source)
          const linkRe = new RegExp(`<link[^>]*href="[^"]*${escapeRe(key)}"[^>]*>`)
          // Function replacement: bundle text is full of `$`, which would be
          // interpreted as a capture reference in a string replacement.
          html = html.replace(linkRe, () => `<style>${css}</style>`)
          delete bundle[key]
        }

        if (chunk.type === 'chunk' && key.endsWith('.js')) {
          // A literal </script> inside a JS string would close the tag early.
          const code = chunk.code.replace(/<\/script>/gi, '<\\/script>')
          const scriptRe = new RegExp(`<script[^>]*src="[^"]*${escapeRe(key)}"[^>]*></script>`)
          html = html.replace(scriptRe, () => `<script type="module">\n${code}\n</script>`)
          delete bundle[key]
        }
      }

      this.emitFile({
        type: 'asset',
        fileName: 'player-template.tpl',
        source: html,
      })
    },
  }
}

export default defineConfig({
  plugins: [inlineHeebo(), react(), inlineSingleFile()],
  resolve: {
    alias: [
      // Swap the data layer so the real kiosk/display components run from the
      // embedded pack instead of the network. This alias must precede '@'.
      {
        find: /^@\/lib\/supabase$/,
        replacement: fileURLToPath(new URL('./src/offline/shim/supabase.ts', import.meta.url)),
      },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  // The player ships as one HTML file; copying public/ next to it would only
  // suggest those files are needed.
  publicDir: false,
  build: {
    outDir: 'dist-offline',
    emptyOutDir: true,
    // Inline every asset (images, fonts) as data URIs rather than emitting files.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    // Relative so nothing resolves against the filesystem root.
    assetsDir: '',
    rollupOptions: {
      input: fileURLToPath(new URL('./offline.html', import.meta.url)),
      output: {
        // One chunk only - a file:// page cannot fetch split chunks.
        inlineDynamicImports: true,
        entryFileNames: 'player.js',
        assetFileNames: 'player.[ext]',
      },
    },
  },
})
