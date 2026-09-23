import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeTask, ApiError, buildTaskCard } from '../src/lib/api.js'

const analyzeResponse = {
  detected: { need: false, users: true, data: false, constraints: false, result: true, criteria: false, contact: false },
  missing: ['need', 'data', 'criteria', 'constraints', 'contact'],
  questions: [
    { field: 'need', text: 'Что должно измениться для клиентов?' },
    { field: 'data', text: 'Какие данные доступны команде?' },
    { field: 'criteria', text: 'Как измерить успех решения?' },
  ],
  source: 'ai',
}

const cardResponse = {
  card: {
    title: 'Бот для записи клиентов', industry: 'Услуги', context: 'Нужен бот для записи клиентов в салон',
    need: 'Автоматизировать запись клиентов', users: 'Клиенты салона', data: '', constraints: '',
    result: 'Бот для записи клиентов', criteria: '', contact: '', format: '',
  },
  warnings: [], source: 'ai',
}

test('analyzeTask sends the agreed JSON request and returns the response', async (t) => {
  const input = { draft: 'Нужен бот для записи клиентов в салон', industry: 'Услуги' }
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/api/constructor/analyze')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), input)
    assert.ok(options.signal instanceof AbortSignal)
    return Response.json(analyzeResponse)
  })

  assert.deepEqual(await analyzeTask(input), analyzeResponse)
  assert.deepEqual(input, { draft: 'Нужен бот для записи клиентов в салон', industry: 'Услуги' })
})

test('buildTaskCard sends the answers and returns the response', async (t) => {
  const input = {
    draft: 'Нужен бот для записи клиентов в салон', industry: 'Услуги',
    answers: { need: 'Автоматизировать запись клиентов' },
  }
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/api/constructor/card')
    assert.deepEqual(JSON.parse(options.body), input)
    return Response.json(cardResponse)
  })

  assert.deepEqual(await buildTaskCard(input), cardResponse)
})

test('422 keeps the input error message and status', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'draft: минимум 3 слова' }, { status: 422 }))

  await assert.rejects(analyzeTask({ draft: 'коротко', industry: '' }), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.kind, 'http')
    assert.equal(error.status, 422)
    assert.equal(error.message, 'draft: минимум 3 слова')
    return true
  })
})

test('503 is an HTTP error even when the error body is not JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Service unavailable', { status: 503 }))

  await assert.rejects(analyzeTask({ draft: 'Нужен бот для записи', industry: '' }), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.kind, 'http')
    assert.equal(error.status, 503)
    assert.match(error.message, /503/)
    assert.doesNotMatch(error.message, /Service unavailable/)
    return true
  })
})

test('a damaged successful JSON response is reported separately', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{broken', { status: 200 }))

  await assert.rejects(analyzeTask({ draft: 'Нужен бот для записи', industry: '' }), {
    name: 'ApiError', kind: 'invalid-json', status: null,
  })
})

test('network errors do not expose the fetch exception', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('private network details') })

  await assert.rejects(analyzeTask({ draft: 'Нужен бот для записи', industry: '' }), (error) => {
    assert.equal(error.kind, 'network')
    assert.equal(error.status, null)
    assert.doesNotMatch(error.message, /private network details/)
    return true
  })
})

test('timeout ends a request even if fetch never settles', async (t) => {
  let requestSignal
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    requestSignal = options.signal
    return new Promise(() => {})
  })

  await assert.rejects(analyzeTask({ draft: 'Нужен бот для записи', industry: '' }, { timeoutMs: 5 }), {
    name: 'ApiError', kind: 'timeout', status: null,
  })
  assert.equal(requestSignal.aborted, true)
})

test('an external abort is distinct from a timeout', async (t) => {
  const controller = new AbortController()
  t.mock.method(globalThis, 'fetch', async () => {
    controller.abort()
    return new Promise(() => {})
  })

  await assert.rejects(analyzeTask({ draft: 'Нужен бот для записи', industry: '' }, { signal: controller.signal }), {
    name: 'ApiError', kind: 'aborted', status: null,
  })
})
