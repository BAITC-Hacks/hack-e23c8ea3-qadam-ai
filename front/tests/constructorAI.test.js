import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeWithFallback, aiStateFromAnalysis, cardWithFallback } from '../src/lib/constructorAI.js'
import { isValidSession } from '../src/lib/catalog.js'
import { SEED_TASKS, SEED_TEAMS, SEED_PROPOSALS } from '../src/data/seed.js'

const draft = 'Нужен бот для записи клиентов в салон'
const input = { draft, industry: 'Услуги' }
const answers = { need: 'Автоматизировать запись клиентов', data: 'Таблица записей в Excel' }
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
    title: 'Бот для записи клиентов', industry: 'Услуги', context: draft,
    need: answers.need, users: 'Клиенты салона', data: answers.data,
    constraints: '', result: 'Бот для записи клиентов', criteria: '', contact: '', format: '',
  },
  warnings: ['Уточните, какие данные доступны команде'], source: 'ai',
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('both constructor requests use AI responses, including question text and warnings', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push([path, JSON.parse(options.body)])
    return json(path.endsWith('/analyze') ? analysis : built)
  })
  const first = await analyzeWithFallback(input)
  const second = await cardWithFallback({ ...input, answers })
  assert.deepEqual(first, analysis)
  assert.deepEqual(second, built)
  assert.deepEqual(calls, [
    ['/api/constructor/analyze', input],
    ['/api/constructor/card', { ...input, answers }],
  ])
})

test('AI and fallback analyses both survive saved-session validation', () => {
  const session = { tasks: SEED_TASKS, teams: SEED_TEAMS, proposals: SEED_PROPOSALS }
  for (const data of [analysis, { ...analysis, source: 'stub' }]) {
    const ai = aiStateFromAnalysis(data, input)
    assert.equal(ai.valid, data.source === 'ai')
    assert.equal(isValidSession({ ...session, builder: { step: 2, draft, industry: input.industry, ai } }), true)
  }
})

test('invalid AI responses independently switch each step to the local stub', async (t) => {
  t.mock.method(globalThis, 'fetch', async (path) => json(path.endsWith('/analyze')
    ? { ...analysis, source: 'stub' }
    : { ...built, card: { ...built.card, owner: true } }))
  const first = await analyzeWithFallback(input)
  const second = await cardWithFallback({ ...input, answers })
  assert.equal(first.source, 'stub')
  assert.ok(first.questions.length >= 3)
  assert.equal(second.source, 'stub')
  assert.equal(second.card.context, draft)
  assert.equal(second.card.need, answers.need)
  assert.equal(second.card.data, answers.data)
  assert.equal(second.card.owner, undefined)
})

for (const [name, response] of [
  ['unavailable API', () => { throw new Error('network failed') }],
  ['404', () => json({ error: 'Not Found' }, 404)],
  ['503', () => json({ error: 'unavailable' }, 503)],
  ['damaged JSON', () => new Response('{broken', { status: 200 })],
  ['timeout', () => new Promise(() => {})],
]) {
  test(`${name} switches both steps to stub and retains the user text`, async (t) => {
    t.mock.method(globalThis, 'fetch', response)
    const options = name === 'timeout' ? { timeoutMs: 5 } : undefined
    const first = await analyzeWithFallback(input, options)
    const second = await cardWithFallback({ ...input, answers }, options)
    assert.equal(first.source, 'stub')
    assert.equal(second.source, 'stub')
    assert.equal(second.card.context, draft)
    assert.equal(second.card.need, answers.need)
  })
}

test('422 remains an input error, without silently switching to the stub', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json({ error: 'Черновик слишком короткий' }, 422))
  for (const request of [
    analyzeWithFallback(input),
    cardWithFallback({ ...input, answers }),
  ]) {
    await assert.rejects(request, { kind: 'http', status: 422, message: 'Черновик слишком короткий' })
  }
})

test('cancellation does not replace a pending AI result with stub data', async (t) => {
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async () => {
    controller.abort()
    return new Promise(() => {})
  })
  await assert.rejects(analyzeWithFallback(input, { signal: controller.signal }), { kind: 'aborted' })
})
