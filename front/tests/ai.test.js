import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeDraft, buildLocalTaskCard, validateAIResponse } from '../src/lib/ai.js'

const fields = ['need', 'users', 'data', 'constraints', 'result', 'criteria', 'contact']
const cardFields = ['title', 'industry', 'context', 'need', 'users', 'data', 'constraints', 'result', 'criteria', 'contact', 'format']

const analysis = {
  detected: { need: false, users: true, data: false, constraints: false, result: true, criteria: false, contact: false },
  missing: ['need', 'data', 'constraints', 'criteria', 'contact'],
  questions: [
    { field: 'need', text: 'Что должно измениться для клиентов?' },
    { field: 'data', text: 'Какие данные доступны команде?' },
    { field: 'criteria', text: 'Как измерить успех решения?' },
  ],
  source: 'ai',
}

const built = {
  card: {
    title: 'Бот для записи клиентов', industry: 'Услуги', context: 'Нужен бот для записи клиентов в салон',
    need: 'Автоматизировать запись клиентов', users: 'Клиенты салона', data: '', constraints: '',
    result: 'Бот для записи клиентов', criteria: '', contact: '', format: '',
  },
  warnings: [], source: 'ai',
}

const copy = (value) => structuredClone(value)
const invalid = (value, kind) => assert.deepEqual(validateAIResponse(value, kind), { ok: false, data: null })

test('validates a complete analysis object and JSON string', () => {
  assert.deepEqual(validateAIResponse(analysis, 'analyze'), { ok: true, data: analysis })
  assert.deepEqual(validateAIResponse(JSON.stringify(analysis), 'analyze'), { ok: true, data: analysis })
  assert.deepEqual(validateAIResponse(analysis, 'card'), { ok: false, data: null })
})

test('rejects malformed and incomplete analyses', async (t) => {
  const cases = {
    'damaged JSON': '{broken',
    'non-object': [],
    'missing top-level property': { ...analysis, source: undefined },
    'extra top-level property': { ...analysis, arbitrary: 'model data' },
    'unknown detected field': { ...analysis, detected: { ...analysis.detected, extra: false } },
    'missing detected field': { ...analysis, detected: Object.fromEntries(Object.entries(analysis.detected).slice(1)) },
    'non-boolean detected value': { ...analysis, detected: { ...analysis.detected, need: 'false' } },
    'inconsistent missing': { ...analysis, missing: ['need'] },
    'duplicate missing': { ...analysis, missing: [...analysis.missing, 'need'] },
    'unknown missing field': { ...analysis, missing: [...analysis.missing, 'extra'] },
    'too few questions': { ...analysis, questions: analysis.questions.slice(0, 2) },
    'too many questions': { ...analysis, questions: [...analysis.questions, ...['constraints', 'contact', 'users'].map((field) => ({ field, text: 'Уточните поле' }))] },
    'empty question': { ...analysis, questions: [{ field: 'need', text: '  ' }, ...analysis.questions.slice(1)] },
    'duplicate question': { ...analysis, questions: [...analysis.questions.slice(0, 2), analysis.questions[0]] },
    'unknown question field': { ...analysis, questions: [{ field: 'extra', text: 'Вопрос?' }, ...analysis.questions.slice(1)] },
    'extra question property': { ...analysis, questions: [{ ...analysis.questions[0], refine: true }, ...analysis.questions.slice(1)] },
    'stub source': { ...analysis, source: 'stub' },
  }
  for (const [name, value] of Object.entries(cases)) await t.test(name, () => invalid(value, 'analyze'))
})

test('accepts complete card with empty fields and nonempty warnings', () => {
  const response = { ...built, warnings: ['Уточните срок перед публикацией'] }
  assert.deepEqual(validateAIResponse(response, 'card'), { ok: true, data: response })
  assert.deepEqual(validateAIResponse(JSON.stringify(built), 'card'), { ok: true, data: built })
})

test('rejects malformed cards and warnings', async (t) => {
  const cases = {
    'damaged JSON': '{broken',
    'missing top-level property': { card: built.card, source: 'ai' },
    'extra top-level property': { ...built, publish: true },
    'missing card field': { ...built, card: Object.fromEntries(Object.entries(built.card).slice(1)) },
    'extra card field': { ...built, card: { ...built.card, owner: true } },
    'non-string card field': { ...built, card: { ...built.card, title: 3 } },
    'non-array warnings': { ...built, warnings: 'check' },
    'non-string warning': { ...built, warnings: [3] },
    'empty warning': { ...built, warnings: ['  '] },
    'stub source': { ...built, source: 'stub' },
  }
  for (const [name, value] of Object.entries(cases)) await t.test(name, () => invalid(value, 'card'))
})

test('local analysis follows the stub contract for five draft types', () => {
  const drafts = [
    { type: 'weak', text: 'Нужен бот для записи клиентов в салон' },
    { type: 'partial', text: 'Клиенты ждут ответа менеджера, нужен сайт для заявок с Excel-выгрузкой' },
    { type: 'detailed', text: 'Клиенты и менеджеры используют CRM, нужен дашборд на основе CSV за месяц, срок две недели, успех — 80% заявок' },
    { type: 'contradictory', text: 'Нужен бот для клиентов через Telegram, но доступ к Telegram запрещён' },
    { type: 'contact', text: 'Нужен сайт для клиентов, контакт для связи demo@example.com' },
  ]
  for (const { type, text } of drafts) {
    const result = analyzeDraft(text)
    assert.equal(result.source, 'stub', type)
    assert.deepEqual(Object.keys(result).sort(), ['detected', 'missing', 'questions', 'source'], type)
    assert.deepEqual(Object.keys(result.detected).sort(), [...fields].sort(), type)
    assert.ok(result.questions.length >= 3 && result.questions.length <= 5, type)
    assert.equal(new Set(result.questions.map((q) => q.field)).size, result.questions.length, type)
    assert.ok(result.questions.every((q) => Object.keys(q).sort().join() === 'field,text' && q.text.trim()), type)
    assert.deepEqual(result.missing.sort(), fields.filter((field) => !result.detected[field]).sort(), type)
    assert.equal(validateAIResponse({ ...result, source: 'ai' }, 'analyze').ok, true, type)
    if (type === 'weak') assert.ok(result.missing.includes('data') && result.missing.includes('criteria'))
    if (type === 'detailed') assert.equal(result.detected.data && result.detected.criteria && result.detected.constraints, true)
    if (type === 'contradictory') assert.equal(result.detected.contact, false)
    if (type === 'contact') assert.equal(result.detected.contact, true)
  }
})

test('local card preserves stated text and leaves unstated fields empty', () => {
  const input = {
    draft: 'Нужен бот для записи клиентов в салон', industry: 'Услуги',
    answers: { need: 'Автоматизировать запись клиентов', data: 'Таблица записей в Excel', extra: 'ignore' },
  }
  const original = copy(input)
  const result = buildLocalTaskCard(input)
  assert.deepEqual(input, original)
  assert.equal(result.source, 'stub')
  assert.deepEqual(result.warnings, [])
  assert.deepEqual(Object.keys(result.card).sort(), [...cardFields].sort())
  assert.equal(result.card.context, input.draft)
  assert.equal(result.card.need, input.answers.need)
  assert.equal(result.card.data, input.answers.data)
  assert.equal(result.card.criteria, '')
  assert.equal(result.card.contact, '')
  assert.equal(result.card.title, 'Нужен бот для записи клиентов в салон')
  assert.equal(validateAIResponse({ ...result, source: 'ai' }, 'card').ok, true)
  invalid(result, 'card')
})
