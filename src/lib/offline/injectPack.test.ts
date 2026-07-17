import test from 'node:test'
import assert from 'node:assert/strict'
import { injectPack, OfflineExportError, slugifyFileName } from './injectPack.ts'
import { makeAction, makePack, makeParticipant } from './fixtures.ts'

const TEMPLATE =
  '<!DOCTYPE html><html><head>' +
  '<script id="game-data" type="application/json">{}</script>' +
  '</head><body></body></html>'

test('round-trips the pack through the injected JSON', () => {
  const pack = makePack({
    participants: [makeParticipant({ external_id: 'P-1', name: 'דנה' })],
    actions: [makeAction({ code: 'A-1', points: 12 })],
  })

  const html = injectPack(TEMPLATE, pack)
  const match = html.match(/type="application\/json">([\s\S]*?)<\/script>/)
  assert.ok(match)
  const parsed = JSON.parse(
    match![1].replace(/\\u003c/g, '<').replace(/\\u003e/g, '>'),
  )
  assert.equal(parsed.participants[0].name, 'דנה')
  assert.equal(parsed.actions[0].points, 12)
})

test('a value containing </script> cannot break out of the tag', () => {
  const pack = makePack({
    participants: [makeParticipant({ external_id: 'P-1', name: 'x</script><script>alert(1)</script>' })],
  })

  const html = injectPack(TEMPLATE, pack)
  // Exactly one opening and one closing game-data script tag survive.
  assert.equal((html.match(/<script/g) ?? []).length, 1)
  assert.equal((html.match(/<\/script>/g) ?? []).length, 1)
  // The raw injected region holds no literal closing tag.
  const region = html.slice(html.indexOf('json">') + 6, html.lastIndexOf('</script>'))
  assert.equal(region.includes('</script>'), false)
})

test('throws when the template lacks the data slot', () => {
  assert.throws(() => injectPack('<html></html>', makePack()), OfflineExportError)
})

test('throws when the template is empty (player not built)', () => {
  assert.throws(() => injectPack('', makePack()), OfflineExportError)
})

test('slugifyFileName strips path-unsafe characters and keeps Hebrew', () => {
  assert.equal(slugifyFileName('נופש משפחתי 2026'), 'נופש-משפחתי-2026')
  assert.equal(slugifyFileName('a/b:c*d?'), 'abcd')
  assert.equal(slugifyFileName('   '), 'game')
})
