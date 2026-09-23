/**
 * Правила каталога и откликов (AGENTS.md → «Правила каталога»).
 * Чистые функции без React: их используют useQadam.jsx, Catalog.jsx, TaskDrawer.jsx
 * и тесты src/lib/catalog.test.js (`npm test`).
 */
import { levelOf } from './scoring.js'

/** Баллы принятой команде за подтверждённый этап (один раз на отклик). */
export const MILESTONE_POINTS = 50
/** Минимальный рейтинг задачи для рекомендаций команде. */
export const RECOMMEND_MIN_SCORE = 40
export const RECOMMEND_LIMIT = 3
export const DECISIONS = ['accepted', 'rejected', 'pending']

/** Поля вопросов ИИ (как QUESTION_BANK / backend QuestionField). */
export const QUESTION_FIELDS = ['need', 'users', 'data', 'constraints', 'result', 'criteria', 'contact']
const QUESTION_FIELD_SET = new Set(QUESTION_FIELDS)

/** Текстовые поля карточки/задачи — должны быть строками (иначе scoreCard падает). */
export const CARD_TEXT_FIELDS = [
  'title', 'industry', 'context', 'need', 'users', 'data',
  'constraints', 'result', 'criteria', 'contact', 'format',
]

export const BUSINESS_VIEWS = ['builder', 'catalog', 'proposals']
export const STUDENT_VIEWS = ['catalog', 'mine']

/** Экраны, доступные роли (без полноценной авторизации). */
export function viewsForRole(role) {
  return role === 'student' ? STUDENT_VIEWS : BUSINESS_VIEWS
}

/** Если view недоступен роли — первый разрешённый. */
export function clampView(role, view) {
  const allowed = viewsForRole(role)
  return allowed.includes(view) ? view : allowed[0]
}

/**
 * Каталог: все задачи любого уровня, по рейтингу по убыванию,
 * при равенстве выше более новая (createdAt больше).
 * @param {Array<{score:number, createdAt?:number}>} tasks — задачи с уже посчитанным score
 */
export function rankTasks(tasks) {
  return [...tasks].sort((a, b) => b.score - a.score || (b.createdAt || 0) - (a.createdAt || 0))
}

/**
 * Фильтры каталога. Ничего не скрывает сверх выбранных фильтров: низкий рейтинг не исключает задачу.
 * @param {Array} ranked — результат rankTasks
 * @param {{industry?: string, level?: string, query?: string}} f — industry/level: '' | 'all' | '__all__' = без фильтра
 */
export function filterCatalog(ranked, { industry = '', level = '', query = '' } = {}) {
  const any = (v) => !v || v === 'all' || v === '__all__'
  const q = query.trim().toLowerCase()
  return ranked.filter((task) => (any(industry) || task.industry === industry)
    && (any(level) || levelOf(task.score).key === level)
    && (!q || `${task.title} ${task.company} ${task.context}`.toLowerCase().includes(q)))
}

/** Позиция задачи в общем каталоге (1-based), не зависит от фильтров. */
export function positionOf(ranked, taskId) {
  return ranked.findIndex((x) => x.id === taskId) + 1
}

/**
 * Рекомендации команде: рейтинг от 40, совпадение тегов задачи с навыками команды
 * и отрасли задачи с интересами. Возвращает до 3 задач; каталог не ограничивает.
 */
export function recommendTasks(ranked, team, limit = RECOMMEND_LIMIT) {
  if (!team) return []
  const skills = new Set((team.skills || []).map((s) => s.toLowerCase()))
  return ranked
    .filter((task) => task.score >= RECOMMEND_MIN_SCORE)
    .map((task) => ({
      task,
      match: (task.tags || []).filter((tag) => skills.has(tag.toLowerCase())).length
        + ((team.interests || []).includes(task.industry) ? 1 : 0),
    }))
    .filter((r) => r.match > 0)
    .sort((a, b) => b.match - a.match || b.task.score - a.task.score)
    .slice(0, limit)
}

/** Корректная http(s)-ссылка с доменом. */
export function isHttpUrl(value) {
  const v = (value || '').trim()
  if (!v || /\s/.test(v)) return false
  try {
    const url = new URL(v)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.')
  } catch {
    return false
  }
}

/**
 * Проверка формы отклика. Возвращает { ok, errors, value } — errors: поле → ключ i18n.
 * Идея, план и срок не пустые; ссылка — http(s).
 */
export function validateProposal(form = {}) {
  const value = {
    idea: (form.idea || '').trim(),
    plan: (form.plan || '').trim(),
    deadline: (form.deadline || '').trim(),
    link: (form.link || '').trim(),
  }
  const errors = {}
  if (!value.idea) errors.idea = 'errIdea'
  if (!value.plan) errors.plan = 'errPlan'
  if (!value.deadline) errors.deadline = 'errDeadline'
  if (!isHttpUrl(value.link)) errors.link = 'errLink'
  return { ok: Object.keys(errors).length === 0, errors, value }
}

/**
 * Добавить отклик. Ошибка, если задачи/команды нет, форма некорректна
 * или эта команда уже откликалась на эту задачу. Число откликов на задачу не ограничено.
 * @returns {{ ok: true, proposals: Array, proposal: object } | { ok: false, error: string, errors?: object }}
 */
export function addProposal({ proposals, tasks, teams, taskId, teamId, form, id = `p${Date.now()}` }) {
  if (!tasks.some((x) => x.id === taskId)) return { ok: false, error: 'errNoTask' }
  if (!teams.some((x) => x.id === teamId)) return { ok: false, error: 'errNoTeam' }
  const v = validateProposal(form)
  if (!v.ok) return { ok: false, error: 'errForm', errors: v.errors }
  if (proposals.some((p) => p.taskId === taskId && p.teamId === teamId)) return { ok: false, error: 'errDuplicate' }
  const proposal = { id, taskId, teamId, status: 'pending', ...v.value }
  return { ok: true, proposal, proposals: [...proposals, proposal] }
}

/**
 * Ручное решение бизнеса по отклику. Разрешено: pending → accepted/rejected, rejected → pending.
 * Принятый отклик с подтверждённым этапом не меняется.
 * Опционально: role / ownerTaskIds — защита от действий студента и чужих задач.
 */
export function decideProposal({ proposals, milestones = {}, proposalId, decision, role, ownerTaskIds }) {
  if (role != null && role !== 'business') return { ok: false, error: 'errForbidden' }
  if (!DECISIONS.includes(decision)) return { ok: false, error: 'errDecision' }
  const p = proposals.find((x) => x.id === proposalId)
  if (!p) return { ok: false, error: 'errNoProposal' }
  if (ownerTaskIds) {
    const owned = ownerTaskIds instanceof Set ? ownerTaskIds.has(p.taskId) : ownerTaskIds.includes(p.taskId)
    if (!owned) return { ok: false, error: 'errForbidden' }
  }
  if (milestones[p.id]) return { ok: false, error: 'errLocked' }
  return { ok: true, proposals: proposals.map((x) => (x.id === proposalId ? { ...x, status: decision } : x)) }
}

/**
 * Подтверждение этапа: +MILESTONE_POINTS принятой команде, повторно не начисляется.
 */
export function confirmMilestone({ proposals, teams, milestones = {}, proposalId, role, ownerTaskIds }) {
  if (role != null && role !== 'business') return { ok: false, error: 'errForbidden' }
  const p = proposals.find((x) => x.id === proposalId)
  if (!p) return { ok: false, error: 'errNoProposal' }
  if (ownerTaskIds) {
    const owned = ownerTaskIds instanceof Set ? ownerTaskIds.has(p.taskId) : ownerTaskIds.includes(p.taskId)
    if (!owned) return { ok: false, error: 'errForbidden' }
  }
  if (p.status !== 'accepted') return { ok: false, error: 'errNotAccepted' }
  if (milestones[p.id]) return { ok: false, error: 'errMilestoneDone' }
  if (!teams.some((x) => x.id === p.teamId)) return { ok: false, error: 'errNoTeam' }
  return {
    ok: true,
    milestones: { ...milestones, [p.id]: true },
    teams: teams.map((x) => (x.id === p.teamId ? { ...x, points: (x.points || 0) + MILESTONE_POINTS } : x)),
  }
}

function isStringRecord(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  return Object.values(obj).every((v) => typeof v === 'string')
}

/** null / number / object instead of string — invalid. Missing key (undefined) — ok. */
function isOptionalString(value) {
  return value === undefined || typeof value === 'string'
}

function isHistoryEntry(h) {
  return !!h && typeof h === 'object' && !Array.isArray(h)
    && typeof h.labelKey === 'string'
    && typeof h.score === 'number'
    && Number.isFinite(h.score)
}

function isAiPayload(ai) {
  if (ai == null) return true
  if (typeof ai !== 'object' || Array.isArray(ai)) return false
  if (typeof ai.raw !== 'string' || typeof ai.valid !== 'boolean') return false
  const data = ai.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  if (!data.detected || typeof data.detected !== 'object' || Array.isArray(data.detected)) return false
  if (!Object.entries(data.detected).every(([k, v]) => QUESTION_FIELD_SET.has(k) && typeof v === 'boolean')) return false
  if (!Array.isArray(data.missing) || !data.missing.every((f) => QUESTION_FIELD_SET.has(f))) return false
  if (!Array.isArray(data.questions) || data.questions.length < 1) return false
  return data.questions.every((q) => q && typeof q === 'object'
    && QUESTION_FIELD_SET.has(q.field)
    && typeof q.text === 'string'
    && (q.refine === undefined || typeof q.refine === 'boolean'))
}

function isCardShape(card) {
  if (card == null) return true
  if (typeof card !== 'object' || Array.isArray(card)) return false
  for (const f of CARD_TEXT_FIELDS) {
    if (!isOptionalString(card[f])) return false
  }
  return true
}

function isTaskShape(x) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !Array.isArray(x.tags)) return false
  if (!isOptionalString(x.company)) return false
  if (x.createdAt != null && typeof x.createdAt !== 'number') return false
  for (const f of CARD_TEXT_FIELDS) {
    if (!isOptionalString(x[f])) return false
  }
  return x.tags.every((tag) => typeof tag === 'string')
}

function isTeamShape(x) {
  return !!x && typeof x === 'object'
    && typeof x.id === 'string'
    && typeof x.name === 'string'
    && Array.isArray(x.skills) && x.skills.every((s) => typeof s === 'string')
    && Array.isArray(x.interests) && x.interests.every((s) => typeof s === 'string')
    && (x.points == null || typeof x.points === 'number')
}

function isProposalShape(x, taskIds, teamIds) {
  return !!x && typeof x === 'object'
    && typeof x.id === 'string'
    && typeof x.taskId === 'string' && taskIds.has(x.taskId)
    && typeof x.teamId === 'string' && teamIds.has(x.teamId)
    && DECISIONS.includes(x.status)
    && typeof x.idea === 'string'
    && typeof x.plan === 'string'
    && typeof x.deadline === 'string'
    && typeof x.link === 'string'
}

function isBuilderShape(b) {
  if (b == null) return true
  if (typeof b !== 'object' || Array.isArray(b)) return false
  if (b.step != null && ![1, 2, 3].includes(b.step)) return false
  if (!isOptionalString(b.draft)) return false
  if (!isOptionalString(b.industry)) return false
  if (b.answers != null && !isStringRecord(b.answers)) return false
  if (b.confirmed != null && typeof b.confirmed !== 'boolean') return false
  if (b.history != null) {
    if (!Array.isArray(b.history) || !b.history.every(isHistoryEntry)) return false
  }
  if (!isCardShape(b.card)) return false
  if (!isAiPayload(b.ai)) return false
  return true
}

/**
 * Предпочтительный teamId, если он есть в списке; иначе первая команда; иначе null.
 */
export function resolveTeamId(teams, preferredId) {
  if (!Array.isArray(teams) || teams.length === 0) return null
  if (preferredId && teams.some((x) => x.id === preferredId)) return preferredId
  return teams[0].id
}

/**
 * Проверка сохранённой сессии из localStorage: при повреждённых данных — false (берём seed).
 * Отклики должны ссылаться на существующие задачи и команды; текстовые поля — только string.
 */
export function isValidSession(s) {
  if (!s || typeof s !== 'object') return false
  if (!Array.isArray(s.tasks) || !s.tasks.every(isTaskShape)) return false
  if (!Array.isArray(s.teams) || s.teams.length < 1 || !s.teams.every(isTeamShape)) return false
  const taskIds = new Set(s.tasks.map((x) => x.id))
  const teamIds = new Set(s.teams.map((x) => x.id))
  if (!Array.isArray(s.proposals) || !s.proposals.every((p) => isProposalShape(p, taskIds, teamIds))) return false
  if (s.milestones != null && (typeof s.milestones !== 'object' || Array.isArray(s.milestones))) return false
  if (s.newTaskId != null && typeof s.newTaskId !== 'string') return false
  if (s.growth != null) {
    if (!Array.isArray(s.growth) || !s.growth.every(isHistoryEntry)) return false
  }
  if (!isBuilderShape(s.builder)) return false
  return true
}
