import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SMS_TEMPLATE,
  SMS_VARIABLES,
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
  firstName: 'דנה',
  lastName: '',
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
  const body = renderSmsTemplate('{{פעילות}}: {{שם פרטי}} / {{משימה}} / {{ניקוד}} / {{סהכ}}', values)
  assert.equal(body, 'ספורטתון קיץ: דנה / ריצת בוקר / 10 / 120')
})

test('spacing inside the braces is what somebody typed, not a broken variable', () => {
  assert.equal(renderSmsTemplate('{{ שם פרטי }} {{שם פרטי}}', values), 'דנה דנה')
})

test('a template written with the English names keeps working', () => {
  assert.equal(renderSmsTemplate('{{first name}}: {{points}}/{{TOTAL}}', values), 'דנה: 10/120')
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
  assert.ok(preview.includes('שרה'))
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

// ============================================================
// FIRST AND FAMILY NAME - the two halves migration 083 stores
// ============================================================

const split: SmsValues = { ...values, name: 'דנה כהן', firstName: 'דנה', lastName: 'כהן' }

test('a message can greet somebody by their first name alone', () => {
  assert.equal(renderSmsTemplate('היי {{שם פרטי}}!', split), 'היי דנה!')
})

test('the whole name is the two halves written side by side', () => {
  assert.equal(renderSmsTemplate('{{שם פרטי}} {{שם משפחה}}', split), 'דנה כהן')
})

test('a template saved with the retired {{שם}} still fills in', () => {
  // No chip offers it any more, but customers have it saved - and a variable
  // that stops resolving goes out in the message with its braces showing.
  assert.equal(renderSmsTemplate('היי {{שם}}!', split), 'היי דנה כהן!')
  assert.deepEqual(unknownSmsVariables('{{שם}}'), [])
})

test('the retired variable is not offered as a chip', () => {
  assert.equal(SMS_VARIABLES.some((v) => v.token === 'שם'), false)
})

test('the family name is its own variable, under either spelling', () => {
  assert.equal(renderSmsTemplate('{{שם משפחה}} · {{surname}} · {{משפחה}}', split), 'כהן · כהן · כהן')
})

test('{{שם פרטי}} falls back to the whole name when there is no division', () => {
  // A roster typed by hand: one field, so nothing was ever split. Greeting the
  // participant by their whole name beats greeting them by nothing.
  const typed: SmsValues = { ...values, name: 'דנה כהן', firstName: '', lastName: '' }

  assert.equal(renderSmsTemplate('היי {{שם פרטי}}!', typed), 'היי דנה כהן!')
})

test('a family name nobody has does not leave a hole in the sentence', () => {
  const typed: SmsValues = { ...values, name: 'דנה', firstName: 'דנה', lastName: '' }

  assert.equal(renderSmsTemplate('היי {{שם פרטי}} {{שם משפחה}}, קיבלת נקודות', typed), 'היי דנה, קיבלת נקודות')
  assert.equal(renderSmsTemplate('{{שם משפחה}} שלום', typed), 'שלום')
})

test('a message laid out over two lines keeps its line break', () => {
  const body = renderSmsTemplate('היי {{שם פרטי}}\nקיבלת {{ניקוד}} נק\'', split)

  assert.equal(body, 'היי דנה\nקיבלת 10 נק\'')
})

test('the preview shows what each half actually sends', () => {
  assert.equal(previewSmsTemplate('{{שם פרטי}}'), 'שרה')
  assert.equal(previewSmsTemplate('{{שם משפחה}}'), 'כהן')
  assert.equal(previewSmsTemplate('{{שם פרטי}} {{שם משפחה}}'), 'שרה כהן')
})

test('both halves are offered as chips in the wizard', () => {
  const tokens = SMS_VARIABLES.map((v) => v.token)

  assert.ok(tokens.includes('שם פרטי'))
  assert.ok(tokens.includes('שם משפחה'))
})

test('the new variables are recognised, not reported as typos', () => {
  assert.deepEqual(unknownSmsVariables('{{שם פרטי}} {{שם משפחה}}'), [])
  assert.deepEqual(usedSmsVariables('{{שם פרטי}} {{שם משפחה}}'), ['שם פרטי', 'שם משפחה'])
})
