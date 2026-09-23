import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveProposalTask } from './proposalSelection.js'

const tasks = [{ id: 'old' }, { id: 'new' }, { id: 'other' }]

test('catalog task wins over the last published task when opening proposals', () => {
  assert.equal(resolveProposalTask(tasks, 'old', 'new')?.id, 'old')
})

test('a manually selected inbox tab survives a new last-published task', () => {
  assert.equal(resolveProposalTask(tasks, 'other', 'new')?.id, 'other')
  assert.equal(resolveProposalTask(tasks, 'other', 'old')?.id, 'other')
})

test('general inbox navigation retains the last-published task default', () => {
  assert.equal(resolveProposalTask(tasks, null, 'new')?.id, 'new')
})

test('stale or other-company IDs fall back only to an available task', () => {
  assert.equal(resolveProposalTask(tasks, 'deleted', 'new')?.id, 'new')
  assert.equal(resolveProposalTask(tasks, 'foreign-task', 'deleted')?.id, 'old')
  const companyTasks = [{ id: 'company-b-task' }]
  assert.equal(resolveProposalTask(companyTasks, 'old', 'new')?.id, 'company-b-task')
})

test('an empty company inbox has no selected task', () => {
  assert.equal(resolveProposalTask([], 'old', 'new'), undefined)
})
