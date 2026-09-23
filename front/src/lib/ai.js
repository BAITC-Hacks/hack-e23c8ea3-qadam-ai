import { words } from './scoring.js'
import { EMPTY_CARD } from '../data/seed.js'

export const AI_PROMPT = `Ты — ассистент платформы Qadam AI. Проанализируй черновик бизнес-задачи.
Верни ТОЛЬКО JSON: {"detected":{<поле>:bool}, "missing":[<поле>], "questions":[{"field":<поле>,"text":<вопрос>}]}
Поля: need, users, data, constraints, result, criteria, contact.
Правила: минимум 3 вопроса; спрашивай о недостающем, от самого весомого;
НЕ добавляй фактов, которых нет в тексте; не заполняй карточку за пользователя.`

export const HINTS = {
  users: /клиент|сотрудник|менеджер|пользоват|покупат|студент|врач|водител|оператор/i,
  data: /данн|excel|таблиц|csv|1с|1c|crm|выгрузк|база|отчёт|отчет|истори/i,
  constraints: /срок|недел|месяц|бюджет|python|api|доступ|telegram|до \d/i,
  result: /бот|дашборд|прототип|сайт|приложени|модел|сервис|систем/i,
  criteria: /\d+\s*(%|процент|раз|мин|час|дн)/i,
}

const CONTACT_HINT = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\+?\d[\d\s()-]{6,}|t\.me\/[a-z0-9_]+|@[a-z][a-z0-9_]{4,}/i

export const QUESTION_BANK = {
  need: { w: 20, text: 'Что именно должно измениться после решения? Опишите желаемое состояние.' },
  data: { w: 20, text: 'Какие данные, примеры или доступы вы готовы дать команде?', refine: 'Вы упомянули данные — какие именно, в каком формате и за какой период?' },
  result: { w: 15, text: 'Что команда должна сдать в конце: прототип, бот, дашборд, отчёт?', refine: 'Какой именно результат вы ждёте и в каком виде его примете?' },
  criteria: { w: 15, text: 'По каким измеримым признакам вы поймёте, что решение работает? Нужны цифры.' },
  users: { w: 10, text: 'Кто будет пользоваться решением каждый день?' },
  constraints: { w: 10, text: 'Какие сроки, технологии или ограничения нужно учесть?' },
  contact: { w: 10, text: 'Кто контактное лицо, как связаться и как часто вы готовы консультировать?' },
}

export function analyzeDraft(draft) {
  const detected = Object.fromEntries(Object.entries(HINTS).map(([k, re]) => [k, re.test(draft)]))
  detected.need = words(draft) >= 12
  detected.contact = CONTACT_HINT.test(draft)
  const order = Object.entries(QUESTION_BANK).sort((a, b) => b[1].w - a[1].w)
  const missing = order.filter(([k]) => !detected[k]).map(([k]) => k)
  let qs = missing.slice(0, 5)
  if (qs.length < 3) qs = [...qs, ...order.map(([k]) => k).filter((k) => !qs.includes(k))].slice(0, 3)
  return {
    detected,
    missing,
    questions: qs.map((field) => ({
      field,
      text: detected[field] && QUESTION_BANK[field].refine ? QUESTION_BANK[field].refine : QUESTION_BANK[field].text,
    })),
    source: 'stub',
  }
}

/** Локальная сборка для работы конструктора при недоступном ИИ. */
export function buildLocalTaskCard({ draft, industry, answers }) {
  const context = draft.trim()
  const card = { ...EMPTY_CARD, industry, context }
  for (const field of Object.keys(QUESTION_BANK)) {
    if (typeof answers[field] === 'string') card[field] = answers[field].trim()
  }
  const first = context.split(/[.!?\n]/)[0]
  const shortTitle = first.length > 70 ? first.slice(0, 67) + '…' : first
  card.title = shortTitle.charAt(0).toUpperCase() + shortTitle.slice(1)
  return { card, warnings: [], source: 'stub' }
}

const QUESTION_FIELDS = Object.keys(QUESTION_BANK)
const CARD_FIELDS = Object.keys(EMPTY_CARD)
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasExactKeys = (value, keys) => isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const nonemptyString = (value) => typeof value === 'string' && value.trim().length > 0

function validAnalysis(obj) {
  if (!hasExactKeys(obj, ['detected', 'missing', 'questions', 'source']) || obj.source !== 'ai') return false
  if (!hasExactKeys(obj.detected, QUESTION_FIELDS) || !QUESTION_FIELDS.every((field) => typeof obj.detected[field] === 'boolean')) return false
  if (!Array.isArray(obj.missing) || obj.missing.length !== new Set(obj.missing).size) return false
  const expectedMissing = QUESTION_FIELDS.filter((field) => !obj.detected[field])
  if (obj.missing.length !== expectedMissing.length || !obj.missing.every((field) => expectedMissing.includes(field))) return false
  if (!Array.isArray(obj.questions) || obj.questions.length < 3 || obj.questions.length > 5) return false
  const asked = new Set()
  return obj.questions.every((question) => {
    if (!hasExactKeys(question, ['field', 'text']) || !QUESTION_FIELDS.includes(question.field) || !nonemptyString(question.text) || asked.has(question.field)) return false
    asked.add(question.field)
    return true
  })
}

function validCard(obj) {
  return hasExactKeys(obj, ['card', 'warnings', 'source']) && obj.source === 'ai'
    && hasExactKeys(obj.card, CARD_FIELDS) && CARD_FIELDS.every((field) => typeof obj.card[field] === 'string')
    && Array.isArray(obj.warnings) && obj.warnings.every(nonemptyString)
}

/** Проверяет только форму ответа API; неверный ответ не попадает в состояние. */
export function validateAIResponse(raw, kind) {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (kind !== 'analyze' && kind !== 'card') return { ok: false, data: null }
    if (!(kind === 'analyze' ? validAnalysis(obj) : validCard(obj))) return { ok: false, data: null }
    return { ok: true, data: obj }
  } catch {
    return { ok: false, data: null }
  }
}
