import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasUtmAttribution,
  normalizeUtmAttribution,
  readUtmFromSearch,
  utmAttributionToParams,
} from './utmAttribution.ts'

test('readUtmFromSearch captures partial short links', () => {
  const utm = readUtmFromSearch('?utm_source=share&utm_content=rs')
  assert.ok(utm)
  assert.equal(utm.utm_source, 'share')
  assert.equal(utm.utm_content, 'rs')
  assert.equal(utm.utm_medium, undefined)
  assert.equal(utm.utm_campaign, undefined)
})

test('readUtmFromSearch ignores missing params without defaults', () => {
  const utm = readUtmFromSearch('?utm_source=share&utm_content=f01')
  assert.ok(utm)
  assert.deepEqual(Object.keys(utm).sort(), ['utm_content', 'utm_source'])
})

test('utmAttributionToParams attaches only available values', () => {
  const params = utmAttributionToParams({
    utm_source: 'share',
    utm_content: 'rs',
  })
  assert.deepEqual(params, {
    utm_source: 'share',
    utm_content: 'rs',
  })
  assert.equal('utm_medium' in params, false)
  assert.equal('utm_campaign' in params, false)
})

test('normalizeUtmAttribution drops empty and absent keys', () => {
  const utm = normalizeUtmAttribution({
    utm_source: 'share',
    utm_medium: '',
    utm_campaign: null,
    utm_content: 'rs',
  })
  assert.deepEqual(utm, {
    utm_source: 'share',
    utm_content: 'rs',
  })
})

test('hasUtmAttribution is true for one param', () => {
  assert.equal(hasUtmAttribution({ utm_content: 'rs' }), true)
  assert.equal(hasUtmAttribution({}), false)
})
