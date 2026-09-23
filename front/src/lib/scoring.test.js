import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as scoring from './scoring.js'

const detailed = 'один два три четыре пять шесть семь восемь девять десять'
const complete = {
  ...Object.fromEntries(scoring.CARD_FIELDS.map(({ key }) => [key, detailed])),
  criteria: `${detailed} 95%`,
  contact: `${detailed} qa@example.com`,
}
const part = (card, key) => scoring.scoreCard(card).parts.find((p) => p.key === key)

test('QA-04: the contact hint promises only the contact gain, not the whole criterion', () => {
  const before = { ...complete, contact: '', format: '' }
  const after = { ...before, contact: complete.contact }
  assert.equal(scoring.scoreCard(before).total, 90)
  assert.equal(scoring.scoreCard(after).total, 96)
  assert.equal(part(before, 'contact').tip, 'tip_contact_channel')
  assert.equal(part(before, 'contact').tipGain, 6)
  assert.equal(part(after, 'contact').tip, 'tip_contact_format')
  assert.equal(part(after, 'contact').tipGain, 4)
})

test('contact hint gain uses the same rounding as the actual score', () => {
  for (const contact of ['', 'Имя', 'Имя qa@example.com', 'Развернутый контакт без канала связи']) {
    for (const format of ['', 'Онлайн', 'Консультации с командой каждую неделю', detailed]) {
      const card = { ...complete, contact, format }
      const current = part(card, 'contact')
      const field = current.tip === 'tip_contact_format' ? 'format' : 'contact'
      const improved = part({ ...card, [field]: complete[field] }, 'contact')
      assert.equal(current.tipGain, improved.points - current.points, `${contact} / ${format}`)
    }
  }
})

test('a short interaction format still gets a format hint after a complete contact', () => {
  const card = { ...complete, format: 'Онлайн' }
  const current = part(card, 'contact')
  assert.equal(current.tip, 'tip_contact_format')
  assert.equal(current.tipGain, part(complete, 'contact').points - current.points)
})

test('context hints account only for the field mentioned in the action', () => {
  const card = { ...complete, context: '', need: '' }
  assert.equal(part(card, 'context').tip, 'tip_context_need')
  assert.equal(part(card, 'context').tipGain, 10)
  const withNeed = { ...card, need: detailed }
  assert.equal(part(withNeed, 'context').tip, 'tip_context_more')
  assert.equal(part(withNeed, 'context').tipGain, 10)
  const shortNeed = { ...complete, need: 'Ускорить запись' }
  assert.equal(part(shortNeed, 'context').tip, 'tip_context_need')
  assert.equal(part(shortNeed, 'context').tipGain, 20 - part(shortNeed, 'context').points)
})

test('adding a numeric success condition does not promise extra text detail points', () => {
  const card = { ...complete, criteria: 'Клиенты успешно записываются самостоятельно без помощи сотрудников' }
  const current = part(card, 'criteria')
  assert.equal(current.tip, 'tip_criteria_number')
  assert.equal(current.tipGain, part({ ...card, criteria: `${card.criteria} 95%` }, 'criteria').points - current.points)
})

test('very short success criteria first request detail with a positive achievable gain', () => {
  const current = part({ ...complete, criteria: 'Работает' }, 'criteria')
  assert.equal(current.tip, 'tip_more')
  assert.equal(current.tipGain, part({ ...complete, criteria: detailed }, 'criteria').points - current.points)
})

test('a numeric tenth word includes the text quality threshold in the hint gain', () => {
  const card = { ...complete, criteria: 'один два три четыре пять шесть семь восемь девять' }
  const current = part(card, 'criteria')
  assert.equal(current.points, 9)
  assert.equal(current.tip, 'tip_criteria_number')
  assert.equal(current.tipGain, 6)
  assert.equal(current.tipGain, part({ ...card, criteria: `${card.criteria} 95%` }, 'criteria').points - current.points)
})

test('score formula remains unchanged for empty, full and intermediate field quality', () => {
  assert.equal(scoring.scoreCard({}).total, 0)
  assert.equal(scoring.scoreCard(complete).total, 100)
  for (const p of scoring.scoreCard(complete).parts) {
    assert.equal(p.tip, null)
    assert.equal(p.tipGain, 0)
  }
  assert.equal(part({ ...complete, data: 'один' }, 'data').points, 7)
  assert.equal(part({ ...complete, data: 'один два три четыре' }, 'data').points, 14)
  assert.equal(part({ ...complete, criteria: detailed }, 'criteria').points, 9)
  assert.equal(scoring.scoreCard(complete).parts.reduce((sum, p) => sum + p.points, 0), 100)
})

test('QA-05: score changes have exactly one sign, and zero has no plus', () => {
  assert.equal(scoring.formatScoreDelta(-7), '−7')
  assert.equal(scoring.formatScoreDelta(7), '+7')
  assert.equal(scoring.formatScoreDelta(0), '0')
  assert.equal(scoring.formatScoreDelta(-0), '0')
})
