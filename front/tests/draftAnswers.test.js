import assert from 'node:assert/strict'
import test from 'node:test'
import { answersAfterDraftChange, cardWithFallback } from '../src/lib/constructorAI.js'

test('a replacement draft cannot inherit answers when card generation falls back', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('API unavailable') })

  const oldDraft = 'Нужен бот для записи клиентов в салон'
  const nextDraft = 'Нужна система учёта товаров на складе'
  const oldAnswers = { need: 'Автоматизировать запись клиентов' }
  const nextAnswers = answersAfterDraftChange(oldDraft, nextDraft, oldAnswers)
  const result = await cardWithFallback({ draft: nextDraft, industry: 'Торговля', answers: nextAnswers })

  assert.deepEqual(nextAnswers, {})
  assert.equal(result.source, 'stub')
  assert.equal(result.card.context, nextDraft)
  assert.equal(result.card.need, '')

  const sameDraftAnswers = { need: 'Учитывать остатки товаров' }
  assert.equal(answersAfterDraftChange(nextDraft, nextDraft, sameDraftAnswers), sameDraftAnswers)
  const retry = await cardWithFallback({ draft: nextDraft, industry: 'Торговля', answers: sameDraftAnswers })
  assert.equal(retry.card.need, sameDraftAnswers.need)
})
