import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adjustWizardStep,
  hiddenWizardSteps,
  isSkippedWizardStep,
  normalizeWizardStep,
  visibleWizardSteps,
} from './wizard.ts'

const game = { isTemplateMode: false, smsEnabled: false }
const smsGame = { isTemplateMode: false, smsEnabled: true }
const template = { isTemplateMode: true }

test('an ordinary game walks six steps and never learns the SMS one exists', () => {
  assert.deepEqual(visibleWizardSteps(game), [1, 2, 3, 4, 5, 7])
  assert.ok(isSkippedWizardStep(6, game))
})

test('a game that was sold SMS gets the step between rewards and cards', () => {
  assert.deepEqual(visibleWizardSteps(smsGame), [1, 2, 3, 4, 5, 6, 7])
  assert.ok(!isSkippedWizardStep(6, smsGame))
})

test('a template has nobody to enrol, nobody to text and no cards to print', () => {
  assert.deepEqual(visibleWizardSteps(template), [1, 2, 4, 5, 8])
  assert.deepEqual(hiddenWizardSteps(template), [3, 6, 7])
})

test('next and back step over what this run does not show', () => {
  assert.equal(adjustWizardStep(5, 'next', game), 7)
  assert.equal(adjustWizardStep(7, 'prev', game), 5)
  assert.equal(adjustWizardStep(5, 'next', smsGame), 6)
  assert.equal(adjustWizardStep(6, 'next', smsGame), 7)
  assert.equal(adjustWizardStep(7, 'prev', smsGame), 6)
})

test('a template walks around its two holes in both directions', () => {
  assert.equal(adjustWizardStep(2, 'next', template), 4)
  assert.equal(adjustWizardStep(4, 'prev', template), 2)
  assert.equal(adjustWizardStep(5, 'next', template), 8)
  assert.equal(adjustWizardStep(8, 'prev', template), 5)
})

test('the ends hold rather than walking off either edge', () => {
  assert.equal(adjustWizardStep(1, 'prev', game), 1)
  assert.equal(adjustWizardStep(7, 'next', game), 7)
  assert.equal(adjustWizardStep(8, 'next', template), 8)
})

test('a step number from a URL lands on a step this run actually has', () => {
  // The saved lastStep of a game that has since lost the SMS flag, and the
  // template summary a game never sees.
  assert.equal(normalizeWizardStep(6, game), 7)
  assert.equal(normalizeWizardStep(8, game), 7)
  assert.equal(normalizeWizardStep(3, template), 4)
  assert.equal(normalizeWizardStep(6, template), 8)
  assert.equal(normalizeWizardStep(7, template), 8)
})

test('a step this run does have is left where it is', () => {
  for (const step of visibleWizardSteps(smsGame)) {
    assert.equal(normalizeWizardStep(step, smsGame), step)
  }
})
