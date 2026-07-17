// End-to-end verification of the exported offline player.
//
// Injects a real pack plus a test-only DOM driver (never shipped) into the built
// template, boots it from file:// in headless Chrome, navigates hub -> scan,
// drives a sequence of scans, then asserts on the DOM: points accrue, the board
// ranks, a reward fires at threshold, max_completions blocks a repeat, and the
// group board sums members.
//
// Usage: node scripts/verify-offline-player.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs'

const outPath = process.argv[2]
if (!outPath) {
  console.error('usage: node scripts/verify-offline-player.mjs <out.html>')
  process.exit(1)
}

const template = readFileSync('dist-offline/player-template.tpl', 'utf8')

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
const sing = act({ id: 'a-sing', code: 'A-2', name: 'שירה', points: 10 })
const reward = {
  id: 'r-gold', event_id: 'evt', name: 'מדליית זהב', required_points: 25, is_active: true,
  target_type: 'all', target_participant_id: null, winner_mode: 'all', created_at: '', updated_at: '',
}

const pack = {
  version: 1, exportedAt: new Date().toISOString(),
  event: { id: 'evt', name: 'טורניר הקיץ', logo_url: null },
  groups: [blue, red],
  participants: [dana, ron],
  participantGroups: [
    { participant_id: dana.id, group_id: blue.id },
    { participant_id: ron.id, group_id: red.id },
  ],
  actions: [dance, sing],
  actionGroups: [],
  rewards: [reward],
  rewardGroups: [],
}

const json = JSON.stringify(pack) // fixture has no angle brackets to escape

// Scan plan (דנה: ריקוד+שירה = 25 -> reward; ריקוד again -> blocked; רון: שירה = 10).
// Expected: scans=3, דנה=25, רון=10, blue=25, red=10, reward fires.
const driver = `
<script>
window.addEventListener('load', () => {
  const plan = [['P-1','A-1'], ['P-1','A-2'], ['P-1','A-1'], ['P-2','A-2']];
  let i = 0, rewardSeen = false, pointsSeen = false, maxTotal = 0;
  setInterval(() => {
    if (document.querySelector('.pl-fb-reward')) rewardSeen = true;
    if (document.querySelector('.pl-fb-points')) pointsSeen = true;
    document.querySelectorAll('.pl-fb-total').forEach(t => {
      const n = parseInt(t.textContent.replace(/[^0-9]/g,'')) || 0; if (n > maxTotal) maxTotal = n;
    });
  }, 50);
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  function scanStep() {
    if (i < plan.length) {
      const inputs = document.querySelectorAll('.pl-manual input');
      const btn = document.querySelector('.pl-manual button');
      if (!inputs.length) { setTimeout(scanStep, 150); return; }
      const [p, a] = plan[i++];
      setVal(inputs[0], p); setVal(inputs[1], a); btn.click();
      setTimeout(scanStep, 500);
    } else {
      const board = [...document.querySelectorAll('.pl-crow')].map(r =>
        r.querySelector('.pl-crow-name').textContent + '=' + r.querySelector('.pl-crow-pts').textContent).join(',');
      const el = document.createElement('div');
      el.id = 'verify';
      el.textContent = 'VERIFY:: scans=' + document.querySelector('.pl-stat-num').textContent +
        ' :: board=' + board + ' :: rewardFired=' + rewardSeen +
        ' :: pointsSeen=' + pointsSeen + ' :: maxTotal=' + maxTotal;
      document.body.appendChild(el);
    }
  }
  // hub -> scan, then drive
  function gotoScan() {
    const card = document.querySelector('[data-hub-action="scan"] button');
    if (!card) { setTimeout(gotoScan, 150); return; }
    card.click();
    setTimeout(scanStep, 500);
  }
  setTimeout(gotoScan, 400);
});
</script>`

const out = template
  .replace(/(<script id="game-data" type="application\/json">)([\s\S]*?)(<\/script>)/, (_m, o, _x, c) => o + json + c)
  .replace('</body>', driver + '</body>')

writeFileSync(outPath, out)
console.log('wrote verification player')
