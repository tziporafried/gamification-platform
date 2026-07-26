// Builds a driven copy of the offline player for screenshotting one view.
// Usage: node scripts/shoot.mjs <hub|scan|display|manage|rewards> <out.html>
import { readFileSync, writeFileSync } from 'node:fs'

const [, , mode, outPath] = process.argv
const template = readFileSync('dist-offline/player-template.tpl', 'utf8')

const g1 = { id: 'g1', event_id: 'evt', name: 'נמרים', color: '#D83000', created_at: '', updated_at: '' }
const g2 = { id: 'g2', event_id: 'evt', name: 'דולפינים', color: '#009090', created_at: '', updated_at: '' }
const P = (id, ext, name) => ({ id, event_id: 'evt', external_id: ext, name, created_at: '', updated_at: '' })
const people = [P('p1','P-1','דנה כהן'), P('p2','P-2','רון לוי'), P('p3','P-3','מאיה בר'), P('p4','P-4','יואב שדה'), P('p5','P-5','נועה גל')]
const A = (id, code, name, pts) => ({ id, event_id: 'evt', code, name, points: pts, description: null, is_active: true, max_completions: null, daily_limit: false, daily_start_hour: null, daily_start_minute: null, daily_end_hour: null, daily_end_minute: null, created_at: '', updated_at: '' })
const dance = A('a1', 'A-1', 'ריקוד', 15)
const quiz = A('a2', 'A-2', 'חידון', 10)
const R = (id, name, winnerMode) => ({ id, event_id: 'evt', name, required_points: 70, is_active: true, target_type: 'all', target_participant_id: null, winner_mode: winnerMode, created_at: '', updated_at: '' })
// One of each kind, so the delete dialog has both cases to show: a prize only
// the first winner may hold, and one anybody past the target gets.
const trophy = R('r1', 'גביע הזהב', 'first')
const medal = R('r2', 'מדליית הצטיינות', 'all')

const pack = {
  version: 1, exportedAt: new Date().toISOString(),
  event: { id: 'evt', name: 'טורניר הקיץ הגדול', logo_url: null },
  groups: [g1, g2], participants: people,
  participantGroups: [
    { participant_id: 'p1', group_id: 'g1' }, { participant_id: 'p2', group_id: 'g2' },
    { participant_id: 'p3', group_id: 'g1' }, { participant_id: 'p4', group_id: 'g2' },
    { participant_id: 'p5', group_id: 'g1' },
  ],
  actions: [dance, quiz], actionGroups: [], rewards: [trophy, medal], rewardGroups: [],
}
const json = JSON.stringify(pack) // no angle brackets in fixture

// Pre-seed varied scores so the leaderboard/podium look real. Spread over the
// last hour and a half, oldest first, so "who got there first" is meaningful:
// דנה crosses 70 before רון, and so holds the first-winner trophy.
const MINUTE = 60000
const at = (minutesAgo) => new Date(Date.now() - minutesAgo * MINUTE).toISOString()
const scans = (pid, times, actionId = 'a1', points = 15) =>
  times.map((minutesAgo, i) => ({ clientTxId: `${pid}-${actionId}-${i}`, participantId: pid, actionId, points, createdAt: at(minutesAgo) }))
const seedScans = [
  ...scans('p1', [90, 84, 78, 72, 66]),            // 75 - crossed 70 at 66 min ago
  ...scans('p2', [80, 74, 68, 62]),                // 60 ...
  ...scans('p2', [56], 'a2', 10),                  // ... + 10 = 70, crossed at 56
  ...scans('p3', [60, 50, 40]),                    // 45
  ...scans('p4', [45, 30]),                        // 30
  ...scans('p5', [20]),                            // 15
]
// The trophy went to the first one past 70; the medal to everyone past it.
const award = (pid, rewardId, score, minutesAgo) => ({ participantId: pid, rewardId, scoreAtAward: score, awardedAt: at(minutesAgo) })
const seedAwards = [
  award('p1', 'r1', 70, 66),
  award('p1', 'r2', 70, 66),
  award('p2', 'r2', 70, 56),
]
const seed = JSON.stringify({ scans: seedScans, awards: seedAwards })

// Classic inline script: runs during parse, BEFORE the deferred module reads state.
const preseed = mode === 'hub'
  ? ''
  : `<script>localStorage.setItem('gamify.offline.state.evt', ${JSON.stringify(seed)});</scr` + `ipt>`

// Navigate hub -> target view after mount. The management popup's own hook sits
// on the pill button itself; the play cards are wrapped, hence the ` button`
// suffix. 'manage' and 'rewards' are the two tabs of that popup.
const HUB_TARGET = {
  scan: '[data-hub-action="scan"] button',
  display: '[data-hub-action="board"] button',
  manage: '[data-hub-action="manage"]',
  rewards: '[data-hub-action="manage"]',
}
// Inside the popup: the scans tab opens the first two participants, the rewards
// tab has to be switched to first (the popup opens on scans).
const AFTER_OPEN = {
  manage: `document.querySelectorAll('table button[aria-expanded]').forEach((b, i) => { if (i < 2) b.click(); });`,
  rewards: `[...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'פרסים').forEach((b) => b.click());`,
}
const navScript = mode === 'hub'
  ? ''
  : `<script>window.addEventListener('load', () => setTimeout(() => {
       const card = document.querySelector('${HUB_TARGET[mode]}');
       if (card) card.click();
       ${AFTER_OPEN[mode] ? `setTimeout(() => { ${AFTER_OPEN[mode]} }, 500);` : ''}
     }, 700));</scr` + `ipt>`

const out = template
  .replace(/(<script id="game-data" type="application\/json">)([\s\S]*?)(<\/script>)/, (_m, o, _x, c) => o + json + c)
  .replace('</head>', preseed + '</head>')
  .replace('</body>', navScript + '</body>')
writeFileSync(outPath, out)
console.log('wrote', mode)
