import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SMS_TEMPLATE,
  SMS_TEMPLATE_MAX_CHARS,
  previewSmsTemplate,
  renderSmsTemplate,
  smsSegments,
  unknownSmsVariables,
  usedSmsVariables,
  validateSmsTemplate,
  type SmsValues,
} from './smsTemplate.ts'

const values: SmsValues = {
  name: 'דנה',
  task: 'ריצת בוקר',
  points: 10,
  total: 120,
  event: 'ספורטתון קיץ',
}

test('the default message carries the three facts the scan is about', () => {
  assert.equal(
    renderSmsTemplate(DEFAULT_SMS_TEMPLATE, values),
    'היי דנה! קיבלת 10 נק\' על "ריצת בוקר". סה"כ יש לך 120 נק\'.',
  )
})

test('a game that never opened the step still sends the default', () => {
  const fromDefault = renderSmsTemplate(DEFAULT_SMS_TEMPLATE, values)
  assert.equal(renderSmsTemplate(null, values), fromDefault)
  assert.equal(renderSmsTemplate(undefined, values), fromDefault)
  assert.equal(renderSmsTemplate('   ', values), fromDefault)
})

test('every variable is filled in, including the game name', () => {
  const body = renderSmsTemplate('{{פעילות}}: {{שם}} / {{משימה}} / {{ניקוד}} / {{סהכ}}', values)
  assert.equal(body, 'ספורטתון קיץ: דנה / ריצת בוקר / 10 / 120')
})

test('spacing inside the braces is what somebody typed, not a broken variable', () => {
  assert.equal(renderSmsTemplate('{{ שם }} {{שם}}', values), 'דנה דנה')
})

test('a template written with the English names keeps working', () => {
  assert.equal(renderSmsTemplate('{{name}}: {{points}}/{{TOTAL}}', values), 'דנה: 10/120')
})

test('the other way of writing סה"כ resolves to the same variable', () => {
  assert.equal(renderSmsTemplate('{{סה"כ}} · {{סה״כ}} · {{סהכ}}', values), '120 · 120 · 120')
})

test('a variable nobody recognises is left standing, so the typo is visible', () => {
  const body = renderSmsTemplate('היי {{שמ}}, צברת {{ניקוד}}', values)
  assert.equal(body, 'היי {{שמ}}, צברת 10')
  assert.deepEqual(unknownSmsVariables('היי {{שמ}}, צברת {{ניקוד}}'), ['שמ'])
})

test('a message with no variables at all is a legitimate message', () => {
  assert.equal(renderSmsTemplate('יאללה, עוד אחת!', values), 'יאללה, עוד אחת!')
  assert.equal(validateSmsTemplate('יאללה, עוד אחת!'), null)
  assert.deepEqual(usedSmsVariables('יאללה, עוד אחת!'), [])
})

test('the variables in use are reported once each, in the order written', () => {
  assert.deepEqual(usedSmsVariables('{{סהכ}} {{שם}} {{name}} {{ניקוד}}'), ['סהכ', 'שם', 'ניקוד'])
})

test('points taken away render as the negative number they are', () => {
  assert.equal(renderSmsTemplate('{{ניקוד}}', { ...values, points: -5 }), '-5')
})

test('an empty message is refused, and one that would cost a fortune per scan', () => {
  assert.equal(validateSmsTemplate(''), 'EMPTY')
  assert.equal(validateSmsTemplate('   \n  '), 'EMPTY')
  assert.equal(validateSmsTemplate('א'.repeat(SMS_TEMPLATE_MAX_CHARS + 1)), 'TOO_LONG')
  assert.equal(validateSmsTemplate('א'.repeat(SMS_TEMPLATE_MAX_CHARS)), null)
})

test('the preview reads as a sentence, with no braces left in it', () => {
  const preview = previewSmsTemplate(DEFAULT_SMS_TEMPLATE)
  assert.ok(!preview.includes('{{'))
  assert.ok(preview.includes('דנה'))
})

test('the default message fits in one billed segment', () => {
  assert.equal(smsSegments(previewSmsTemplate(DEFAULT_SMS_TEMPLATE)), 1)
})

test('a customer who wrote a sentence for a task title costs a second segment, not a lost message', () => {
  const body = renderSmsTemplate(DEFAULT_SMS_TEMPLATE, {
    ...values,
    task: 'להשלים את כל תחנות המסלול הצפוני ולחזור לנקודת ההתחלה עם כל הציוד',
  })
  assert.ok(body.includes('המסלול הצפוני'))
  assert.ok(smsSegments(body) > 1)
})
