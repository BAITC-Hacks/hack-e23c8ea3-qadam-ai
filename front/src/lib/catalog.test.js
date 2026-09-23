// Тесты правил каталога и откликов: `npm test` (встроенный node:test, без зависимостей).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rankTasks, filterCatalog, positionOf, recommendTasks, isHttpUrl, validateProposal,
  addProposal, decideProposal, confirmMilestone, isValidSession, MILESTONE_POINTS,
  viewsForRole, clampView, resolveTeamId,
} from './catalog.js'
import { scoreCard } from './scoring.js'
import { SEED_TASKS, SEED_TEAMS, SEED_PROPOSALS } from '../data/seed.js'

const scored = () => SEED_TASKS.map((t) => ({ ...t, score: scoreCard(t).total }))
const form = { idea: 'Telegram-бот для записи', plan: 'Неделя 1 — сценарии', deadline: '3 недели', link: 'https://github.com/team/bot' }

test('каталог отсортирован по рейтингу по убыванию', () => {
  const r = rankTasks(scored())
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score)
})

test('при равном рейтинге выше более новая задача', () => {
  const r = rankTasks([{ id: 'old', score: 50, createdAt: 1 }, { id: 'new', score: 50, createdAt: 2 }, { id: 'top', score: 90, createdAt: 0 }])
  assert.deepEqual(r.map((x) => x.id), ['top', 'new', 'old'])
})

test('задачи с низким рейтингом остаются в каталоге', () => {
  const r = rankTasks(scored())
  const low = r.filter((x) => x.score < 40)
  assert.ok(low.length > 0, 'в seed есть черновик')
  assert.equal(filterCatalog(r).length, SEED_TASKS.length)
  assert.equal(filterCatalog(r, { industry: '__all__', level: 'all' }).length, SEED_TASKS.length)
})

test('фильтр по отрасли и уровню', () => {
  const r = rankTasks(scored())
  const logistics = filterCatalog(r, { industry: 'Логистика' })
  assert.ok(logistics.length > 0 && logistics.every((x) => x.industry === 'Логистика'))
  const drafts = filterCatalog(r, { level: 'draft' })
  assert.ok(drafts.length > 0 && drafts.every((x) => x.score < 40))
  const priority = filterCatalog(r, { level: 'priority' })
  assert.ok(priority.every((x) => x.score >= 90))
  assert.deepEqual(filterCatalog(r, { industry: 'Логистика', level: 'draft' }).map((x) => x.id),
    r.filter((x) => x.industry === 'Логистика' && x.score < 40).map((x) => x.id))
})

test('позиция считается по всему каталогу, а не по фильтру', () => {
  const r = rankTasks(scored())
  assert.equal(positionOf(r, r[2].id), 3)
  assert.equal(positionOf(r, 'nope'), 0)
})

test('рекомендации: только рейтинг от 40 и есть совпадение, не больше 3', () => {
  const r = rankTasks(scored())
  for (const team of SEED_TEAMS) {
    const recs = recommendTasks(r, team)
    assert.ok(recs.length <= 3)
    for (const { task, match } of recs) {
      assert.ok(task.score >= 40)
      assert.ok(match > 0)
    }
  }
  assert.deepEqual(recommendTasks(r, null), [])
})

test('ссылка на прототип: только http(s) с доменом', () => {
  assert.ok(isHttpUrl('https://github.com/a/b'))
  assert.ok(isHttpUrl('http://figma.com/x'))
  for (const bad of ['', 'github.com/a', 'ftp://x.com', 'https://localhost', 'javascript:alert(1)', 'https://a.com b']) assert.equal(isHttpUrl(bad), false, bad)
})

test('валидация отклика: пустые поля и плохая ссылка', () => {
  const v = validateProposal({ idea: '  ', plan: '', deadline: '', link: 'не ссылка' })
  assert.equal(v.ok, false)
  assert.deepEqual(Object.keys(v.errors).sort(), ['deadline', 'idea', 'link', 'plan'])
  const ok = validateProposal({ ...form, idea: '  ' + form.idea + ' ' })
  assert.equal(ok.ok, true)
  assert.equal(ok.value.idea, form.idea)
})

test('создание отклика, в том числе на задачу-черновик', () => {
  const r = rankTasks(scored())
  const draft = r.find((x) => x.score < 40)
  const res = addProposal({ proposals: SEED_PROPOSALS, tasks: r, teams: SEED_TEAMS, taskId: draft.id, teamId: 'k2', form, id: 'pX' })
  assert.equal(res.ok, true)
  assert.equal(res.proposals.length, SEED_PROPOSALS.length + 1)
  assert.deepEqual(res.proposal, { id: 'pX', taskId: draft.id, teamId: 'k2', status: 'pending', ...form })
})

test('отклик: несуществующие задача и команда, повтор, некорректная форма', () => {
  const base = { proposals: SEED_PROPOSALS, tasks: SEED_TASKS, teams: SEED_TEAMS, form }
  assert.equal(addProposal({ ...base, taskId: 'nope', teamId: 'k1' }).error, 'errNoTask')
  assert.equal(addProposal({ ...base, taskId: 't1', teamId: 'nope' }).error, 'errNoTeam')
  const existing = SEED_PROPOSALS[0]
  assert.equal(addProposal({ ...base, taskId: existing.taskId, teamId: existing.teamId }).error, 'errDuplicate')
  const bad = addProposal({ ...base, taskId: 't1', teamId: 'k5', form: { ...form, link: 'ftp://x' } })
  assert.equal(bad.error, 'errForm')
  assert.deepEqual(bad.errors, { link: 'errLink' })
})

test('на одну задачу могут откликнуться несколько команд', () => {
  let proposals = []
  for (const team of SEED_TEAMS) {
    const res = addProposal({ proposals, tasks: SEED_TASKS, teams: SEED_TEAMS, taskId: 't1', teamId: team.id, form, id: `p-${team.id}` })
    assert.equal(res.ok, true)
    proposals = res.proposals
  }
  assert.equal(proposals.length, SEED_TEAMS.length)
})

test('ручное решение: принять, отклонить, вернуть; недопустимое решение', () => {
  const [p1, p2] = SEED_PROPOSALS
  let res = decideProposal({ proposals: SEED_PROPOSALS, proposalId: p1.id, decision: 'accepted' })
  assert.equal(res.proposals.find((x) => x.id === p1.id).status, 'accepted')
  res = decideProposal({ proposals: res.proposals, proposalId: p2.id, decision: 'rejected' })
  assert.equal(res.proposals.find((x) => x.id === p2.id).status, 'rejected')
  assert.equal(res.proposals.find((x) => x.id === p1.id).status, 'accepted', 'другие отклики не меняются')
  assert.equal(decideProposal({ proposals: res.proposals, proposalId: p2.id, decision: 'pending' }).ok, true)
  assert.equal(decideProposal({ proposals: SEED_PROPOSALS, proposalId: p1.id, decision: 'auto' }).error, 'errDecision')
  assert.equal(decideProposal({ proposals: SEED_PROPOSALS, proposalId: 'nope', decision: 'accepted' }).error, 'errNoProposal')
})

test('нет автоматического выбора: все отклики стартуют на рассмотрении', () => {
  const res = addProposal({ proposals: [], tasks: SEED_TASKS, teams: SEED_TEAMS, taskId: 't1', teamId: 'k1', form })
  assert.equal(res.proposal.status, 'pending')
})

test(`этап: +${MILESTONE_POINTS} принятой команде и без повторного начисления`, () => {
  const p = SEED_PROPOSALS[0]
  const before = SEED_TEAMS.find((x) => x.id === p.teamId).points
  assert.equal(confirmMilestone({ proposals: SEED_PROPOSALS, teams: SEED_TEAMS, proposalId: p.id }).error, 'errNotAccepted')
  const accepted = decideProposal({ proposals: SEED_PROPOSALS, proposalId: p.id, decision: 'accepted' }).proposals
  const res = confirmMilestone({ proposals: accepted, teams: SEED_TEAMS, milestones: {}, proposalId: p.id })
  assert.equal(res.ok, true)
  assert.equal(res.teams.find((x) => x.id === p.teamId).points, before + MILESTONE_POINTS)
  const again = confirmMilestone({ proposals: accepted, teams: res.teams, milestones: res.milestones, proposalId: p.id })
  assert.equal(again.error, 'errMilestoneDone')
  assert.equal(decideProposal({ proposals: accepted, milestones: res.milestones, proposalId: p.id, decision: 'rejected' }).error, 'errLocked')
})

test('сохранённая сессия: повреждённые данные отбрасываются', () => {
  assert.equal(isValidSession({ tasks: SEED_TASKS, teams: SEED_TEAMS, proposals: SEED_PROPOSALS, milestones: {} }), true)
  for (const bad of [null, 'x', {}, { tasks: 'x', teams: [], proposals: [] }, { tasks: [{}], teams: [], proposals: [] }]) assert.equal(isValidSession(bad), false)
})

test('сессия: число вместо текста в поле карточки — невалидно', () => {
  const tasks = SEED_TASKS.map((t, i) => (i === 0 ? { ...t, context: 42 } : t))
  assert.equal(isValidSession({ tasks, teams: SEED_TEAMS, proposals: SEED_PROPOSALS }), false)
})

test('сессия: отклик на несуществующую задачу или команду — невалидно', () => {
  const base = { tasks: SEED_TASKS, teams: SEED_TEAMS, milestones: {} }
  assert.equal(isValidSession({
    ...base,
    proposals: [{ id: 'px', taskId: 'missing', teamId: 'k1', status: 'pending', idea: 'a', plan: 'b', deadline: '1', link: 'https://a.com/x' }],
  }), false)
  assert.equal(isValidSession({
    ...base,
    proposals: [{ id: 'px', taskId: 't1', teamId: 'missing', status: 'pending', idea: 'a', plan: 'b', deadline: '1', link: 'https://a.com/x' }],
  }), false)
})

test('сессия: builder с битой карточкой отбрасывается', () => {
  assert.equal(isValidSession({
    tasks: SEED_TASKS,
    teams: SEED_TEAMS,
    proposals: SEED_PROPOSALS,
    builder: { step: 2, draft: 'ok', card: { context: 7 } },
  }), false)
  assert.equal(isValidSession({
    tasks: SEED_TASKS,
    teams: SEED_TEAMS,
    proposals: SEED_PROPOSALS,
    builder: { step: 2, draft: 'черновик задачи здесь', answers: { need: 'текст' }, card: { context: 'строка' } },
  }), true)
})

test('сессия: пустой ai, null в card и null в history — невалидно', () => {
  const base = { tasks: SEED_TASKS, teams: SEED_TEAMS, proposals: SEED_PROPOSALS }
  assert.equal(isValidSession({ ...base, builder: { step: 2, draft: 'текст', ai: {} } }), false)
  assert.equal(isValidSession({ ...base, builder: { step: 2, draft: 'текст', card: { context: null } } }), false)
  assert.equal(isValidSession({ ...base, builder: { step: 2, draft: 'текст', history: [null] } }), false)
  assert.equal(isValidSession({
    ...base,
    builder: {
      step: 2,
      draft: 'нужен бот для записи',
      ai: {
        raw: '{"questions":[]}',
        valid: true,
        data: {
          detected: { need: true },
          missing: ['data'],
          questions: [{ field: 'data', text: 'Какие данные?' }],
        },
      },
      history: [{ labelKey: 'hist_draft', score: 7 }],
      card: { context: 'строка' },
    },
  }), true)
})

test('сессия: неизвестное поле вопроса ИИ — невалидно', () => {
  const base = { tasks: SEED_TASKS, teams: SEED_TEAMS, proposals: SEED_PROPOSALS }
  const ai = {
    raw: '{}',
    valid: true,
    data: {
      detected: { need: false },
      missing: ['need'],
      questions: [{ field: 'unknown_field', text: 'Что это?' }],
    },
  }
  assert.equal(isValidSession({ ...base, builder: { step: 2, draft: 'черновик задачи', ai } }), false)
  assert.equal(isValidSession({
    ...base,
    builder: {
      step: 2,
      draft: 'черновик задачи',
      ai: {
        ...ai,
        data: {
          detected: { need: false, spooky: true },
          missing: ['need'],
          questions: [{ field: 'need', text: 'Что нужно?' }],
        },
      },
    },
  }), false)
  assert.equal(isValidSession({
    ...base,
    builder: {
      step: 2,
      draft: 'черновик задачи',
      ai: {
        ...ai,
        data: {
          detected: { need: false },
          missing: ['hacked'],
          questions: [{ field: 'need', text: 'Что нужно?' }],
        },
      },
    },
  }), false)
})

test('сессия: пустой список команд — невалидно', () => {
  assert.equal(isValidSession({ tasks: SEED_TASKS, teams: [], proposals: [] }), false)
})

test('resolveTeamId выбирает существующую команду', () => {
  assert.equal(resolveTeamId(SEED_TEAMS, 'k4'), 'k4')
  assert.equal(resolveTeamId(SEED_TEAMS, 'missing'), 'k1')
  assert.equal(resolveTeamId([], 'k1'), null)
  assert.equal(resolveTeamId([{ id: 'only', name: 'X', skills: [], interests: [] }], 'k1'), 'only')
})

test('экраны ограничены ролью', () => {
  assert.deepEqual(viewsForRole('business'), ['builder', 'catalog', 'proposals'])
  assert.deepEqual(viewsForRole('student'), ['catalog', 'mine'])
  assert.equal(clampView('student', 'proposals'), 'catalog')
  assert.equal(clampView('business', 'mine'), 'builder')
  assert.equal(clampView('student', 'catalog'), 'catalog')
})

test('студент не может принять отклик или подтвердить этап', () => {
  const p = SEED_PROPOSALS[0]
  const ownerTaskIds = new Set(SEED_TASKS.filter((x) => x.owner).map((x) => x.id))
  assert.equal(decideProposal({
    proposals: SEED_PROPOSALS, proposalId: p.id, decision: 'accepted', role: 'student', ownerTaskIds,
  }).error, 'errForbidden')
  const accepted = decideProposal({
    proposals: SEED_PROPOSALS, proposalId: p.id, decision: 'accepted', role: 'business', ownerTaskIds,
  }).proposals
  assert.equal(confirmMilestone({
    proposals: accepted, teams: SEED_TEAMS, proposalId: p.id, role: 'student', ownerTaskIds,
  }).error, 'errForbidden')
})

test('бизнес не решает по чужой задаче', () => {
  const foreign = SEED_PROPOSALS.find((p) => p.taskId === 't1')
  const ownerTaskIds = new Set(SEED_TASKS.filter((x) => x.owner).map((x) => x.id))
  assert.ok(foreign)
  assert.ok(!ownerTaskIds.has(foreign.taskId))
  assert.equal(decideProposal({
    proposals: SEED_PROPOSALS, proposalId: foreign.id, decision: 'accepted', role: 'business', ownerTaskIds,
  }).error, 'errForbidden')
})
