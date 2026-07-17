/**
 * Vercel Routing Middleware — runs at the edge before any static file is served.
 *
 * Two jobs:
 *   1. Reject self-identifying AI crawlers with 403.
 *   2. Best-effort per-IP rate limiting on document requests.
 *
 * IMPORTANT — what this is and is not:
 *
 * User-Agent is a client-supplied string and is trivially forged. Everything
 * here only stops crawlers that honestly announce themselves, which the major
 * AI crawlers currently do. It is a politeness fence, not a security boundary:
 * anyone willing to send `User-Agent: Mozilla/5.0` walks straight through it.
 * Treat it as one layer on top of robots.txt, never as content protection.
 *
 * The real access-control boundary for this app is Supabase RLS, because the
 * browser talks to supabase.co directly and that traffic never passes through
 * this middleware.
 *
 * File lives at the project root by Vercel convention. It is deliberately
 * outside tsconfig's `include` (which covers only `src`), so `tsc -b` does not
 * typecheck it; Vercel compiles it for the edge runtime at deploy time.
 */

/**
 * Explicit allowlist-style denylist: only these exact tokens are blocked.
 * Matching on generic substrings like "bot" or "crawler" would catch Googlebot,
 * uptime checks, link unfurlers and some real browsers, so we never do that.
 */
const BLOCKED_AI_AGENTS = [
  'claudebot',
  'claude-user',
  'claude-searchbot',
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'google-extended',
  'ccbot',
  'perplexitybot',
  'perplexity-user',
  'bytespider',
  'amazonbot',
  'applebot-extended',
  'facebookbot',
  'meta-externalagent',
  'cohere-ai',
  'diffbot',
  'youbot',
]

/** Paths that must stay reachable by anyone, including blocked agents. */
const ALWAYS_ALLOWED_PATHS = new Set([
  // A blocked crawler still has to be able to read the rules telling it to leave.
  '/robots.txt',
  '/favicon.svg',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
])

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 60

/**
 * Per-instance request counters.
 *
 * This is intentionally weak. Edge instances are ephemeral, per-region and not
 * shared, so a client spread across regions — or hitting a cold instance — gets
 * a fresh budget. It catches naive single-source hammering and nothing more.
 * Durable, trustworthy rate limiting has to come from Vercel WAF; see
 * SECURITY_SETUP.md.
 */
const requestCounts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string, now: number): boolean {
  const entry = requestCounts.get(ip)

  if (!entry || now >= entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count += 1
  return entry.count > RATE_LIMIT_MAX_REQUESTS
}

/** Drop expired buckets so the map cannot grow without bound on a warm instance. */
function evictExpired(now: number): void {
  for (const [ip, entry] of requestCounts) {
    if (now >= entry.resetAt) requestCounts.delete(ip)
  }
}

export default function middleware(request: Request): Response | undefined {
  const url = new URL(request.url)
  const pathname = url.pathname

  if (ALWAYS_ALLOWED_PATHS.has(pathname)) return undefined

  const userAgent = request.headers.get('user-agent') ?? ''
  const normalizedAgent = userAgent.toLowerCase()
  const blockedAgent = BLOCKED_AI_AGENTS.find((agent) => normalizedAgent.includes(agent))

  if (blockedAgent) {
    // UA and path only — never log headers, cookies or tokens.
    console.log(
      JSON.stringify({ event: 'ai_agent_blocked', agent: blockedAgent, path: pathname }),
    )
    return new Response('Automated AI access is not permitted.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  // Vercel sets x-forwarded-for at the edge; it is not client-controllable here.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (ip === 'unknown') return undefined

  const now = Date.now()
  evictExpired(now)

  if (isRateLimited(ip, now)) {
    const retryAfter = Math.max(
      1,
      Math.ceil(((requestCounts.get(ip)?.resetAt ?? now) - now) / 1000),
    )
    // IP is operational data, not personal content. No request body, no headers.
    console.log(JSON.stringify({ event: 'rate_limited', ip, path: pathname }))
    return new Response('Too many requests. Please slow down.', {
      status: 429,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'retry-after': String(retryAfter),
      },
    })
  }

  return undefined
}

// The matcher skips hashed build output and image assets: they are not worth an
// edge invocation each, and a crawler that only fetches them learns nothing.
// Everything that serves the SPA document still goes through here.
//
// Keep comments inside this object as `//` or `/* */`, never `/** */`. A JSDoc
// block attaches a JSDocComment node to the property and shifts the child
// indices that Vercel's static config reader relies on, which fails the build
// with: Unhandled type: "ColonToken".
export const config = {
  matcher: ['/((?!assets/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|map)$).*)'],
}
