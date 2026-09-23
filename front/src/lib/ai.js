import { words, hasContact } from './scoring.js'

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
  detected.contact = hasContact(draft)
  const order = Object.entries(QUESTION_BANK).sort((a, b) => b[1].w - a[1].w)
  const missing = order.filter(([k]) => !detected[k]).map(([k]) => k)
  let qs = missing.slice(0, 5)
  if (qs.length < 3) qs = [...qs, ...order.map(([k]) => k).filter((k) => !qs.includes(k))].slice(0, 3)
  return {
    detected,
    missing,
    questions: qs.map((field) => {
      const refine = !!(detected[field] && QUESTION_BANK[field].refine)
      return {
        field,
        refine,
        text: refine ? QUESTION_BANK[field].refine : QUESTION_BANK[field].text,
      }
    }),
  }
}

/** Обработка некорректного ответа модели: невалидный JSON / <3 вопросов → шаблонные вопросы. */
export function validateAIResponse(raw) {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    const ok = Array.isArray(obj?.questions) && obj.questions.length >= 3 && obj.questions.every((q) => QUESTION_BANK[q.field] && q.text)
    if (!ok) throw new Error('schema')
    return { ok: true, data: obj }
  } catch {
    return { ok: false, data: { detected: {}, missing: ['need', 'data', 'result'], questions: ['need', 'data', 'result'].map((f) => ({ field: f, text: QUESTION_BANK[f].text })) } }
  }
}
