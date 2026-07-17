// Builds a driven copy of the offline player for screenshotting one view.
// Usage: node scripts/shoot.mjs <hub|scan|display> <out.html>
import { readFileSync, writeFileSync } from 'node:fs'

const [, , mode, outPath] = process.argv
const template = readFileSync('dist-offline/player-template.tpl', 'utf8')

const g1 = { id: 'g1', event_id: 'evt', name: 'נמרים', color: '#D83000', created_at: '', updated_at: '' }
const g2 = { id: 'g2', event_id: 'evt', name: 'דולפינים', color: '#009090', created_at: '', updated_at: '' }
const P = (id, ext, name) => ({ id, event_id: 'evt', external_id: ext, name, created_at: '', updated_at: '' })
const people = [P('p1','P-1','דנה כהן'), P('p2','P-2','רון לוי'), P('p3','P-3','מאיה בר'), P('p4','P-4','יואב שדה'), P('p5','P-5','נועה גל')]
const A = (id, code, name, pts) => ({ id, event_id: 'evt', code, name, points: pts, description: null, is_active: true, max_completions: null, daily_limit: false, daily_start_hour: null, daily_start_minute: null, daily_end_hour: null, daily_end_minute: null, created_at: '', updated_at: '' })
const dance = A('a1', 'A-1', 'ריקוד', 15)
const reward = { id: 'r1', event_id: 'evt', name: 'גביע הזהב', required_points: 30, is_active: true, target_type: 'all', target_participant_id: null, winner_mode: 'all', created_at: '', updated_at: '' }

const pack = {
  version: 1, exportedAt: new Date().toISOString(),
  event: { id: 'evt', name: 'טורניר הקיץ הגדול', logo_url: null },
  groups: [g1, g2], participants: people,
  participantGroups: [
    { participant_id: 'p1', group_id: 'g1' }, { participant_id: 'p2', group_id: 'g2' },
    { participant_id: 'p3', group_id: 'g1' }, { participant_id: 'p4', group_id: 'g2' },
    { participant_id: 'p5', group_id: 'g1' },
  ],
  actions: [dance], actionGroups: [], rewards: [reward], rewardGroups: [],
}
const json = JSON.stringify(pack) // no angle brackets in fixture

// Pre-seed varied scores so the leaderboard/podium look real.
const scan = (pid, n) => Array.from({ length: n }, (_, i) => ({ clientTxId: pid + '-' + i, participantId: pid, actionId: 'a1', points: 15, createdAt: new Date(Date.now() - (5 - n) * 1000 + i).toISOString() }))
const seedScans = [...scan('p1', 5), ...scan('p2', 4), ...scan('p3', 3), ...scan('p4', 2), ...scan('p5', 1)]
const seed = JSON.stringify({ scans: seedScans, awards: [] })

// Classic inline script: runs during parse, BEFORE the deferred module reads state.
const preseed = mode === 'hub'
  ? ''
  : `<script>localStorage.setItem('gamify.offline.state.evt', ${JSON.stringify(seed)});</scr` + `ipt>`

// Navigate hub -> target view after mount.
const navScript = mode === 'hub'
  ? ''
  : `<script>window.addEventListener('load', () => setTimeout(() => {
       const card = document.querySelector('[data-hub-action="${mode === 'scan' ? 'scan' : 'board'}"] button');
       if (card) card.click();
     }, 700));</scr` + `ipt>`

const out = template
  .replace(/(<script id="game-data" type="application\/json">)([\s\S]*?)(<\/script>)/, (_m, o, _x, c) => o + json + c)
  .replace('</head>', preseed + '</head>')
  .replace('</body>', navScript + '</body>')
writeFileSync(outPath, out)
console.log('wrote', mode)
