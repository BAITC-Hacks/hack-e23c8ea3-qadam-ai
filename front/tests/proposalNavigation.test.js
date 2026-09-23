import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveProposalTask } from '../src/lib/proposalSelection.js'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const proposals = readFileSync(new URL('../src/features/proposals/Proposals.jsx', import.meta.url), 'utf8')

// Wiring guard: node:test has no DOM renderer. The repeated-click flow is also
// checked in the browser; this prevents a second, unsynchronised tab state.
test('manual tabs and explicit navigation share the Shell selection state', () => {
  assert.match(app, /onSelectTask=\{setInboxTaskId\}/)
  assert.match(proposals, /resolveProposalTask\(tasks, requestedTaskId, newTaskId\)/)
  assert.match(proposals, /onClick=\{\(\) => onSelectTask\(x\.id\)\}/)
  assert.doesNotMatch(proposals, /\buseState\b/)
})

test('changing the selected task does not remount the inbox', () => {
  const inbox = app.slice(app.indexOf('<Proposals'), app.indexOf('/>', app.indexOf('<Proposals')))
  assert.match(inbox, /key=\{`\$\{q\.role\}:\$\{q\.companyId\}`\}/)
})

test('an explicit task can be selected again after any number of manual tab changes', () => {
  const tasks = [{ id: 'old' }, { id: 'new' }, { id: 'other' }]
  let selectedTaskId = null
  const select = (id) => { selectedTaskId = id }
  const current = () => resolveProposalTask(tasks, selectedTaskId, 'new')?.id
  for (const id of ['new', 'old', 'new', 'other', 'new']) {
    select(id)
    assert.equal(current(), id)
  }
  // Unrelated renders keep the manual choice; general navigation resets it.
  select('old')
  assert.equal(current(), 'old')
  assert.equal(current(), 'old')
  select(null)
  assert.equal(current(), 'new')
})
