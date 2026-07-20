# Security Setup

Manual steps and known limits for the anti-scraping / hardening layer.
Code-level pieces are already in the repo; everything below needs a human in the
Vercel or Supabase dashboard.

## What is already in code

| Layer | File | Status |
| --- | --- | --- |
| AI crawler robots directives | `public/robots.txt` | Done |
| User-Agent 403 block | `middleware.ts` | Done |
| Best-effort rate limiting | `middleware.ts` | Done, weak - see below |
| Security headers + CSP | `vercel.json` | Done |
| Copyright footer / terms | `src/components/layout/SiteFooter.tsx`, `src/pages/TermsPage.tsx` | Done |
| Verification script | `scripts/verify-bot-protection.sh` | Done |

## Read this first: what these protections actually do

Be clear-eyed about the threat model, because the gap between what this looks
like and what it does is large.

**These measures stop honest crawlers only.** `robots.txt` is advisory. The
User-Agent block only catches bots that truthfully say who they are. Both are
defeated by one flag:

```
curl -A "Mozilla/5.0" https://your-app.vercel.app/
```

That request is indistinguishable from a real browser and will be served
normally. There is no fix for this at the User-Agent layer - the header is
client-controlled.

**Anything the browser can render, a determined scraper can take.** This is a
public marketing site plus a login-gated SPA. The landing page content is public
by design; a headless browser can read all of it. The protections here raise the
effort and establish an explicit, documented policy (useful if you ever need to
point at terms someone violated). They are not content DRM.

**The real boundary is Supabase RLS, and middleware does not touch it.** The
browser calls `https://<project>.supabase.co` directly. That traffic never
passes through Vercel, so `middleware.ts` cannot see it, block it, or rate-limit
it. If RLS policies are wrong, the anon key in the JS bundle is enough to read
data - and no amount of edge middleware changes that. **Auditing RLS is a higher
security priority than any item in this document.**

## Manual step 1 - Vercel WAF rate limiting (recommended)

The limiter in `middleware.ts` keeps counters in per-instance memory. Edge
instances are ephemeral, regional and not shared, so a client that spreads
requests across regions - or lands on a cold instance - gets a fresh budget.
It catches naive hammering from one source and little else.

Durable rate limiting needs Vercel's WAF (**Pro plan or higher**):

1. Vercel Dashboard → your project → **Firewall**
2. **Configure** → **Rate Limiting** → add a rule:
   - Name: `page-requests`
   - Condition: Request Path matches `/.*` (regex)
   - Rate: **60 requests per 60s**, keyed by **IP address**
   - Action: **Deny** (returns 429)
3. Add a stricter rule for rapid traversal:
   - Name: `rapid-traversal`
   - Rate: **200 requests per 60s**, keyed by **IP address**
   - Action: **Challenge** or **Deny**
4. Optionally add a **Bot Filter** rule under Firewall → Managed Rulesets to
   block known AI crawlers at the platform edge, which is cheaper and more
   reliable than the middleware check.

Once WAF rules are live, the in-middleware limiter can be deleted - it exists
only because dashboard rules cannot be committed to git.

`@vercel/firewall` was deliberately **not** installed: its `checkRateLimit()`
also requires a paid Firewall plan, so it would add a dependency without adding
capability on the free tier.

## Manual step 2 - deploy the security migrations (ORDER MATTERS)

Migrations `061` and `062` and the `notify-contact-request` change ship together.
**Apply the migration before deploying the function.** The new function code
writes `contact_upgrade_requests.notified_at`; if that column does not exist yet,
every notification fails with a 500 and admins silently stop receiving contact
emails.

```bash
supabase db push                                    # 1. migrations 061 + 062
supabase functions deploy notify-contact-request    # 2. only after step 1
```

Verify the search_path pinning took effect - this should return **zero rows**:

```sql
SELECT p.oid::regprocedure AS unpinned_function
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND NOT EXISTS (
    SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
    WHERE c LIKE 'search_path=%'
  );
```

Verify the replay guard - the second call must report `already notified` and send
no email:

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/notify-contact-request" \
  -H "Content-Type: application/json" -d '{"requestId":"<a-real-request-id>"}'
```

## Manual step 3 - Supabase API rate limiting

Rate limiting for the actual data API cannot live in this repo, because those
requests go browser → Supabase directly.

1. Supabase Dashboard → **Settings** → **API** → review rate limits
2. Supabase Dashboard → **Authentication** → **Rate Limits** - cap sign-in,
   sign-up and OTP attempts
3. **Audit RLS on every table.** This is the control that actually protects
   event data, participants and scores.

## Manual step 4 - owner name

`OWNER_NAME` in `src/components/layout/SiteFooter.tsx` is set to `Gamify`. It
renders in the footer and on `/terms`. Update it if the registered legal
entity differs. The terms text is generic boilerplate and is **not legal advice** - have
a lawyer review it before relying on it.

## Content Security Policy notes

The CSP in `vercel.json` is tuned to what the app actually loads:

| Directive | Why |
| --- | --- |
| `script-src https://*.googletagmanager.com` | GA4 gtag.js, loaded by `initAnalytics()` |
| `style-src 'unsafe-inline'` | Tailwind + framer-motion inline styles |
| `font-src https://fonts.gstatic.com` | Heebo webfont |
| `img-src … https://*.supabase.co` | Event logos from Supabase Storage (`event-logos`) |
| `connect-src …supabase… + GA/Google collect hosts` | Supabase + GA4 `g/collect` (incl. regional + `google.com`) |
| `frame-ancestors 'none'` | app is never embedded - no iframes in the codebase |

`script-src` carries **no `'unsafe-inline'`**. The inline gtag snippet was removed
from `index.html`; `initAnalytics()` owns loading gtag.js. The stub must push the
`arguments` object into `dataLayer` (Google's snippet shape) - pushing a rest-params
`Array` causes gtag.js to ignore the pre-load queue and drop all hits. Verified in
headless Chrome against this CSP: the app mounts, the GA tag is injected, and collect
requests are not CSP-blocked.

A CSP **hash** was deliberately rejected instead. The repo stores `index.html`
with LF but `core.autocrlf=true` produces CRLF locally, so a hash computed on
Windows would not match Vercel's Linux build - GA would break silently in
production only. Removing the inline script avoids that trap entirely.

`style-src` still needs `'unsafe-inline'` (Tailwind + framer-motion inline
styles). That is much lower risk than script-level inline execution.

**If you add a new third-party service (payments, chat widget, error tracking),
its origin must be added to the CSP or the browser will silently block it.**

## Verification

```bash
./scripts/verify-bot-protection.sh https://your-app.vercel.app
```

Middleware does **not** run under `vite dev` or `vite preview`; test against a
Vercel preview deployment. Manual equivalents:

```bash
curl -I -A "ClaudeBot" https://your-app.vercel.app/          # expect 403
curl -I -A "Claude-User" https://your-app.vercel.app/        # expect 403
curl -I -A "Mozilla/5.0" https://your-app.vercel.app/        # expect 200
curl -I -A "Googlebot/2.1" https://your-app.vercel.app/      # expect 200
curl https://your-app.vercel.app/robots.txt                  # expect directives
```

## Monitoring

`middleware.ts` emits structured JSON to Vercel logs - `ai_agent_blocked` and
`rate_limited` events, carrying only user-agent token, path and IP. No headers,
cookies, tokens or bodies are logged.

Vercel's log retention on the free/Hobby plan is short (roughly 1 hour), so
these are useful for spot checks, not trend analysis. For durable monitoring,
add a Log Drain (Vercel Dashboard → Project → Settings → Log Drains) or query
Firewall analytics once WAF is enabled.

## Known ineffective entries (kept deliberately)

`Google-Extended` and `Applebot-Extended` are `robots.txt`-only opt-out tokens -
Google and Apple never send them as a real `User-Agent`. They are listed in
`middleware.ts` for completeness and cost nothing, but the `robots.txt` entry is
the one that does the work.
