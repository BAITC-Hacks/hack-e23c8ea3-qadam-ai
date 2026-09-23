import assert from 'node:assert/strict'
import test from 'node:test'
import { answersAfterDraftChange, cardWithAI } from '../src/lib/constructorAI.js'

test('a replacement draft drops old answers and a failed request preserves new answers', async (t) => {
  const sent = []
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    sent.push(JSON.parse(options.body))
    throw new Error('API unavailable')
  })

  const oldDraft = 'Нужен бот для записи клиентов в салон'
  const nextDraft = 'Нужна система учёта товаров на складе'
  const oldAnswers = { need: 'Автоматизировать запись клиентов' }
  const nextAnswers = answersAfterDraftChange(oldDraft, nextDraft, oldAnswers)
  await assert.rejects(cardWithAI({ draft: nextDraft, industry: 'Торговля', answers: nextAnswers }))

  assert.deepEqual(nextAnswers, {})
  assert.deepEqual(sent[0].answers, {})

  const sameDraftAnswers = { need: 'Учитывать остатки товаров' }
  assert.equal(answersAfterDraftChange(nextDraft, nextDraft, sameDraftAnswers), sameDraftAnswers)
  await assert.rejects(cardWithAI({ draft: nextDraft, industry: 'Торговля', answers: sameDraftAnswers }))
  assert.deepEqual(sent[1].answers, sameDraftAnswers)
  assert.equal(sameDraftAnswers.need, 'Учитывать остатки товаров')
})
