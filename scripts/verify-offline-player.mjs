// End-to-end verification of the exported offline player.
//
// Injects a real pack plus a test-only driver (never shipped) into the built
// template, boots it from file:// in headless Chrome, and walks the game the
// way an operator does: scan two cards through manual entry, get blocked by
// max_completions, collect a prize, read the board, open the management
// screen, run a lottery to a winner, and find that lottery in the log.
//
// This is the only check that covers the *wiring* - the components talking to
// the supabase shim inside a real browser. Every unit test underneath it can
// pass while an insert lands in the wrong table, which is exactly what once
// happened to the lottery.
//
// Usage: node scripts/verify-offline-player.mjs [--keep <out.html>]
//        CHROME_PATH=/path/to/chrome node scripts/verify-offline-player.mjs
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const keepIndex = process.argv.indexOf('--keep')
const keepPath = keepIndex > -1 ? process.argv[keepIndex + 1] : null
const outPath = keepPath ?? join(tmpdir(), `offline-player-verify-${process.pid}.html`)

const TEMPLATE = 'dist-offline/player-template.tpl'
if (!existsSync(TEMPLATE)) {
  console.error(`✖ ${TEMPLATE} is missing - run "npm run build:offline" first.`)
  process.exit(1)
}

// ── the game under test ──────────────────────────────────────────────────────

const blue = { id: 'g-blue', event_id: 'evt', name: 'כחולים', color: '#2E6FA6', created_at: '', updated_at: '' }
const red = { id: 'g-red', event_id: 'evt', name: 'אדומים', color: '#B4331F', created_at: '', updated_at: '' }
const dana = { id: 'p-dana', event_id: 'evt', external_id: 'P-1', name: 'דנה', created_at: '', updated_at: '' }
const ron = { id: 'p-ron', event_id: 'evt', external_id: 'P-2', name: 'רון', created_at: '', updated_at: '' }
const act = (over) => ({
  id: over.id, event_id: 'evt', code: over.code, name: over.name, points: over.points,
  description: null, is_active: true, max_completions: over.max_completions ?? null,
  daily_limit: false, daily_start_hour: null, daily_start_minute: null,
  daily_end_hour: null, daily_end_minute: null, created_at: '', updated_at: '',
})
const dance = act({ id: 'a-dance', code: 'A-1', name: 'ריקוד', points: 15, max_completions: 1 })
const quiz = act({ id: 'a-quiz', code: 'A-2', name: 'חידון', points: 10 })
const reward = {
  id: 'r-gold', event_id: 'evt', name: 'מדליית זהב', required_points: 25, is_active: true,
  target_type: 'all', target_participant_id: null, winner_mode: 'all', created_at: '', updated_at: '',
}

const pack = {
  version: 1,
  exportedAt: new Date().toISOString(),
  event: { id: 'evt', name: 'טורניר הקיץ', logo_url: null },
  groups: [blue, red],
  participants: [dana, ron],
  participantGroups: [
    { participant_id: dana.id, group_id: blue.id },
    { participant_id: ron.id, group_id: red.id },
  ],
  actions: [dance, quiz],
  actionGroups: [],
  rewards: [reward],
  rewardGroups: [],
}

// ── the driver ───────────────────────────────────────────────────────────────
//
// Written against the real app's DOM: the kiosk's manual entry, the management
// modal's tabs, the lottery dock. It waits for conditions rather than sleeping
// for fixed amounts, so it neither races the app nor pads the run.
//
// The intro bed gates the ceremony on the audio's `ended` event, and media
// playback does not advance under Chrome's virtual clock - so audio is stubbed
// to end at once. That is also a real machine's behaviour when it cannot play
// sound, which the show is meant to survive.

const driver = `
<script>
/**
 * Two stand-ins, both for the same reason: Chrome advances its virtual clock
 * only while the renderer is idle, and only for timers.
 *
 * Frames become timers, so the ceremony's continuous animation cannot hold the
 * clock still - without this the show sits on its first countdown for ever.
 * And the intro bed gates the draw on the audio's \`ended\` event, which media
 * playback would have to reach in real time; ending it at once is also what a
 * machine that cannot play sound does, which the show is meant to survive.
 */
window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16);
window.cancelAnimationFrame = (id) => window.clearTimeout(id);
HTMLMediaElement.prototype.play = function () {
  setTimeout(() => this.dispatchEvent(new Event('ended')), 30)
  return Promise.resolve()
};

window.__result = { checks: [], errors: [] };
const R = window.__result;
window.addEventListener('error', (e) => R.errors.push('error: ' + (e.message || e)));
window.addEventListener('unhandledrejection', (e) => R.errors.push('rejection: ' + (e.reason && (e.reason.message || e.reason))));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => document.body.innerText.replace(/\\s+/g, ' ');
const buttons = () => [...document.querySelectorAll('button')];
const byLabel = (needle) => buttons().find((b) => b.textContent.includes(needle));
const state = () => { try { return JSON.parse(localStorage.getItem('gamify.offline.state.evt') || '{}') } catch { return {} } };
const check = (name, ok, detail) => R.checks.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail).slice(0, 200) });

/**
 * Waits for a condition instead of sleeping a guessed amount.
 *
 * A timeout is normally a failure worth reporting - except where the app is
 * *supposed* to refuse, which is what expectingRefusal() is for.
 */
let quiet = false;
async function waitFor(what, fn, timeout = 20000) {
  const started = Date.now();
  for (;;) {
    let value = null;
    try { value = fn() } catch (e) { value = null }
    if (value) return value;
    if (Date.now() - started > timeout) {
      if (!quiet) R.errors.push('timeout waiting for ' + what);
      return null;
    }
    await sleep(120);
  }
}

/** Runs something that is expected to get nowhere, without calling it an error. */
async function expectingRefusal(fn) {
  quiet = true;
  try { return await fn() } finally { quiet = false }
}

function setInput(el, value) {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Fills one autocomplete and picks its suggestion.
 *
 * The options are searched inside the field itself, not the page: the kiosk
 * behind the form is full of buttons carrying task names, and a looser search
 * happily clicks the "recommended task" card instead of the dropdown.
 */
async function pick(placeholderPart, query, timeout = 6000) {
  const input = await waitFor('input ' + placeholderPart, () =>
    [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes(placeholderPart)), timeout);
  if (!input) return false;
  input.focus();
  input.click();
  setInput(input, query);
  const field = input.closest('div').parentElement;
  const option = await waitFor('option ' + query, () =>
    [...field.querySelectorAll('button')].find((b) => b.textContent.includes(query)), timeout);
  if (!option) return false;
  option.click();
  await sleep(200);
  return true;
}

/**
 * Opens manual entry if it is not already open.
 *
 * The toggle closes the panel again, and the kiosk closes it itself after a
 * scan - so this waits between presses rather than polling one, which would
 * open and shut it in a loop.
 */
async function openManualEntry() {
  for (let attempt = 0; attempt < 6; attempt++) {
    for (let i = 0; i < 20; i++) {
      if (buttons().some((b) => b.textContent.trim() === 'שלח')) return true;
      await sleep(120);
    }
    const opener = byLabel('הזנה ידנ');
    if (opener) opener.click();
  }
  R.errors.push('manual entry never opened');
  return false;
}

const scanCount = () => (state().scans || []).length;

/** Empties whatever a refused attempt left selected in the form. */
function clearForm() {
  document.querySelectorAll('[aria-label="ניקוי הבחירה"]').forEach((b) => b.click());
}

/**
 * One scan through the form, waited out on the saved game rather than on a
 * sleep.
 *
 * Retried, because the kiosk holds off a scan while the previous one is still
 * celebrating on screen - one participant at a time, the same rule the scanner
 * follows. So a refused attempt is not a failure yet; it is the celebration
 * still running, and the operator would simply press again.
 */
async function manualScan(participant, action, { optionTimeout, attempts = 4 } = {}) {
  const before = scanCount();
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (!(await openManualEntry())) return false;
    clearForm();
    if (!(await pick('שם משתתף', participant, optionTimeout))) return false;
    if (!(await pick('משימה', action, optionTimeout))) return false;
    const submit = await waitFor('submit', () =>
      buttons().find((b) => b.textContent.trim() === 'שלח' && !b.disabled), 6000);
    if (!submit) return false;
    submit.click();

    const landed = await expectingRefusal(() =>
      waitFor('the scan to be saved', () => (scanCount() > before ? true : null), 6000));
    if (landed) { await sleep(400); return true }
    await sleep(2500);
  }
  return false;
}

async function goHome() {
  const back = await waitFor('back', () => buttons().find((b) => /חזרה/.test(b.textContent)));
  if (back) back.click();
  await waitFor('hub', () => document.querySelector('[data-hub-action="scan"]'));
  await sleep(300);
}

async function openManageTab(label) {
  const manage = await waitFor('manage button', () => document.querySelector('[data-hub-action="manage"]'));
  if (manage) manage.click();
  const tab = await waitFor('tab ' + label, () => buttons().find((b) => b.textContent.trim() === label));
  if (tab) tab.click();
  await sleep(600);
}

async function closeModal() {
  const close = document.querySelector('[aria-label="סגירה"], [aria-label="סגור"]') ||
    buttons().find((b) => b.textContent.trim() === '×');
  if (close) close.click();
  await sleep(400);
}

async function run() {
  // ── the kiosk ──────────────────────────────────────────────────────────────
  check('the hub names the game', text().includes('טורניר הקיץ'));

  (await waitFor('scan card', () => document.querySelector('[data-hub-action="scan"] button'))).click();
  await waitFor('kiosk', () => byLabel('הזנה ידנ'));

  check('a card scores', await manualScan('דנה', 'ריקוד'), text().slice(0, 120));
  check('the scan is saved', (state().scans || []).length === 1);

  check('a second task scores too', await manualScan('דנה', 'חידון'));
  const afterTwo = state();
  check('two scans, 25 points', (afterTwo.scans || []).reduce((s, x) => s + x.points, 0) === 25);
  check('the prize fired at its threshold', (afterTwo.awards || []).length === 1,
    JSON.stringify(afterTwo.awards || []));

  // max_completions = 1 on ריקוד: the same card again must not score. The form
  // may not even offer the task any more, which is the same rule one step
  // earlier - either way the scan log must not grow.
  await expectingRefusal(() => manualScan('דנה', 'ריקוד', { optionTimeout: 2500, attempts: 1 }));
  check('max_completions blocks the repeat', scanCount() === 2, 'scans=' + scanCount());

  // ── the board ──────────────────────────────────────────────────────────────
  await goHome();
  (await waitFor('board card', () => document.querySelector('[data-hub-action="board"] button'))).click();
  const board = await waitFor('board', () => (text().includes('טורניר הקיץ') ? text() : null));
  check('the board screen opens', !!board, (board || '').slice(0, 140));
  await goHome();

  // ── the management screen ──────────────────────────────────────────────────
  await openManageTab('סריקות');
  check('the scan log adds the scans up', /2 סריקות/.test(text()) && /25 נקודות/.test(text()), text().slice(-200));
  await openManageTab('פרסים');
  check('the prize log names the winner', text().includes('מדליית זהב'));
  await openManageTab('הגרלות');
  check('no lotteries before one is run', text().includes('עדיין לא בוצעו הגרלות'));
  await closeModal();

  // ── the lottery ────────────────────────────────────────────────────────────
  (await waitFor('live events card', () => document.querySelector('[data-hub-action="live-events"] button'))).click();
  const card = await waitFor('lottery card', () => buttons().find((b) => b.textContent.includes('בחרו פרס ומשתתפים')));
  if (card) card.click();

  const prizeInput = await waitFor('prize input', () =>
    [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('פרס')) ||
    [...document.querySelectorAll('input[type=text]')][0]);
  if (prizeInput) { prizeInput.focus(); setInput(prizeInput, 'סל פינוקים') }
  await sleep(300);

  check('the pool is offered by points as well as to everyone',
    [...document.querySelectorAll('[role="radio"]')].some((r) => r.textContent.includes('לפי נקודות')));

  const launch = await waitFor('launch', () => buttons().find((b) => b.textContent.includes('התחילו בהגרלה') && !b.disabled));
  if (launch) launch.click();

  // The dock is replaced by the show. Staying on it means the launch was
  // refused - the reason is written just above the bar.
  const started = await waitFor('the ceremony to start', () => (text().includes('מי משתתף') ? null : true), 15000);
  check('the lottery launches', !!started, text().slice(0, 200));

  // The ceremony is ~37s of animation; wait on the record it leaves behind.
  const drawn = await waitFor('the draw to be recorded', () => ((state().draws || []).length ? state().draws : null), 240000);
  check('the winner is recorded', !!drawn, drawn ? JSON.stringify(drawn[0]).slice(0, 160) : 'stuck at: ' + text().slice(0, 180));
  if (drawn) {
    check('the record carries the prize and a winner',
      drawn[0].prizeName === 'סל פינוקים' && !!drawn[0].winnerName, drawn[0].winnerName);
    check('the whole pool is kept, not only the winner', drawn[0].entrants.length === 2,
      'entrants=' + drawn[0].entrants.length);
  }
  check('a draw does not touch the scores', (state().scans || []).length === 2 &&
    (state().scans || []).every((s) => Number.isFinite(s.points)));

  // ── and the lottery shows up in the log ────────────────────────────────────
  await goHome();
  await openManageTab('הגרלות');
  const log = text();
  check('the lottery appears in the management screen', log.includes('סל פינוקים'), log.slice(-200));

  const el = document.createElement('pre');
  el.id = 'verify';
  el.textContent = JSON.stringify(R);
  document.body.appendChild(el);
}

window.addEventListener('load', () => { setTimeout(() => { run().catch((e) => {
  R.errors.push('driver: ' + (e && e.message));
  const el = document.createElement('pre');
  el.id = 'verify';
  el.textContent = JSON.stringify(R);
  document.body.appendChild(el);
}) }, 600) });
</script>`

// ── build, run, report ───────────────────────────────────────────────────────

const template = readFileSync(TEMPLATE, 'utf8')
if (!template.includes('id="game-data"') || !template.includes('</body>')) {
  console.error('✖ the template has no data slot to inject into - its shape changed.')
  process.exit(1)
}

const json = JSON.stringify(pack) // fixture has no angle brackets to escape
const html = template
  .replace(/(<script id="game-data" type="application\/json">)([\s\S]*?)(<\/script>)/, (_m, open, _old, close) => open + json + close)
  .replace('</body>', driver + '</body>')
writeFileSync(outPath, html)

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('✖ no Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.')
  process.exit(1)
}

const run = spawnSync(
  chrome,
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--mute-audio',
    '--force-prefers-reduced-motion',
    '--allow-file-access-from-files',
    // The walk is a couple of minutes of animation, most of it the ceremony.
    // Timers are advanced rather than waited on - see the frame stub in the
    // driver, without which the clock would stop the moment the show starts.
    '--virtual-time-budget=1800000',
    '--dump-dom',
    `file://${outPath}`,
  ],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
)

if (!keepPath) rmSync(outPath, { force: true })

const dom = run.stdout ?? ''
const match = dom.match(/<pre id="verify">([\s\S]*?)<\/pre>/)
if (!match) {
  console.error('✖ the player never finished its walk - no result was written.')
  console.error('   Re-run with --keep /tmp/player.html and open it in a browser to see where it stopped.')
  process.exit(1)
}

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const result = JSON.parse(decode(match[1]))

let failed = 0
for (const { name, ok, detail } of result.checks) {
  console.log(`${ok ? '✔' : '✖'} ${name}${ok || !detail ? '' : `  (${detail})`}`)
  if (!ok) failed += 1
}
for (const error of result.errors) {
  console.log(`✖ ${error}`)
  failed += 1
}

console.log(`\n${result.checks.length} checks, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
