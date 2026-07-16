#!/usr/bin/env bash
# Verifies the AI-crawler protections against a deployed URL.
#
#   ./scripts/verify-bot-protection.sh https://your-app.vercel.app
#
# Must run against a real Vercel deployment (preview or production).
# `vite dev` and `vite preview` do not run Routing Middleware, so every bot
# check below will fail locally — that is expected, not a regression.

set -uo pipefail

BASE_URL="${1:-}"
if [ -z "$BASE_URL" ]; then
  echo "usage: $0 <base-url>" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"

pass=0
fail=0

check_status() {
  local label="$1" expected="$2" agent="$3" path="$4"
  local actual
  actual=$(curl -s -o /dev/null -w '%{http_code}' -A "$agent" "${BASE_URL}${path}")
  if [ "$actual" = "$expected" ]; then
    echo "  PASS  $label (got $actual)"
    pass=$((pass + 1))
  else
    echo "  FAIL  $label (expected $expected, got $actual)"
    fail=$((fail + 1))
  fi
}

BROWSER_UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

echo "Testing ${BASE_URL}"
echo
echo "Real users and search engines must NOT be blocked:"
check_status "regular browser -> 200" 200 "$BROWSER_UA" "/"
check_status "Googlebot -> 200"       200 "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "/"
check_status "Bingbot -> 200"         200 "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" "/"

echo
echo "AI crawlers must be blocked:"
check_status "ClaudeBot -> 403"       403 "ClaudeBot/1.0" "/"
check_status "Claude-User -> 403"     403 "Mozilla/5.0 (compatible; Claude-User/1.0)" "/"
check_status "GPTBot -> 403"          403 "GPTBot/1.1" "/"
check_status "CCBot -> 403"           403 "CCBot/2.0" "/"
check_status "PerplexityBot -> 403"   403 "PerplexityBot/1.0" "/"

echo
echo "robots.txt stays readable even for blocked agents:"
check_status "robots.txt (browser) -> 200"  200 "$BROWSER_UA" "/robots.txt"
check_status "robots.txt (ClaudeBot) -> 200" 200 "ClaudeBot/1.0" "/robots.txt"

echo
echo "robots.txt content:"
if curl -s -A "$BROWSER_UA" "${BASE_URL}/robots.txt" | grep -qi "ClaudeBot"; then
  echo "  PASS  robots.txt lists ClaudeBot"
  pass=$((pass + 1))
else
  echo "  FAIL  robots.txt missing ClaudeBot"
  fail=$((fail + 1))
fi

echo
echo "Security headers:"
headers=$(curl -sI -A "$BROWSER_UA" "${BASE_URL}/")
for h in "x-content-type-options" "referrer-policy" "content-security-policy" "permissions-policy" "x-frame-options"; do
  if printf '%s' "$headers" | grep -qi "^${h}:"; then
    echo "  PASS  $h present"
    pass=$((pass + 1))
  else
    echo "  FAIL  $h missing"
    fail=$((fail + 1))
  fi
done

echo
echo "Rate limiting (70 rapid requests; expect at least one 429):"
echo "  NOTE: in-memory and per-edge-instance, so this legitimately flaps."
echo "        A miss here is a known limitation, not proof of a bug."
got429=0
for _ in $(seq 1 70); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -A "$BROWSER_UA" "${BASE_URL}/")
  [ "$code" = "429" ] && got429=1 && break
done
if [ "$got429" = "1" ]; then
  echo "  PASS  received a 429"
else
  echo "  WARN  no 429 seen — see SECURITY_SETUP.md for durable WAF limiting"
fi

echo
echo "Passed: $pass   Failed: $fail"
[ "$fail" -eq 0 ]
