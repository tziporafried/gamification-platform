// Resolve the project's `@/*` alias for Node's native TypeScript test runner,
// so `npm run test:offline` needs no bundler and no extra dependency.
//
// Node ESM wants explicit extensions; the app's `@/...` imports omit them, so we
// also probe `.ts` / `.tsx` / index files the way a bundler would.
import { access } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const SRC = resolvePath(process.cwd(), 'src')
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

async function firstThatExists(basePath) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = basePath + suffix
    try {
      await access(candidate)
      return candidate
    } catch {
      // keep looking
    }
  }
  return null
}

export async function resolve(specifier, context, next) {
  let basePath = null

  if (specifier.startsWith('@/')) {
    basePath = resolvePath(SRC, specifier.slice(2))
  } else if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL &&
    !/\.[cm]?[jt]sx?$/.test(specifier)
  ) {
    // Extensionless relative import between source files.
    basePath = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)
  }

  if (basePath) {
    const found = await firstThatExists(basePath)
    if (found) return next(pathToFileURL(found).href, context)
  }

  return next(specifier, context)
}
