/**
 * Qadam AI — дизайн-прототип (single component).
 * Стек: React + Tailwind CSS + lucide-react.
 * Шрифты (подключить в index.html): Unbounded 500/600/700, Onest 400/500/600, JetBrains Mono 400/500.
 *
 * Сквозной сценарий кейса AI Sana:
 * черновик → AI-уточнение (≥3 вопроса) → редактируемая карточка → рейтинг 0–100
 * → публикация в каталог по рейтингу → отклик команды → ручной выбор бизнеса → баллы команде.
 *
 * Для Cursor: логику (scoreCard, analyzeDraft, validateAIResponse) и данные (SEED_*)
 * вынести в src/lib и src/data, UI разбить на компоненты — см. design/DESIGN.md.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  Sparkles, LayoutGrid, PenLine, Inbox, Search, Check, X, ArrowRight, ArrowLeft,
  ArrowUpRight, ChevronRight, Briefcase, GraduationCap, Users, Database, Target, Flag,
  ShieldCheck, Clock, Link2, Send, TrendingUp, LoaderCircle, Lock, Info, Trophy,
  Handshake, Building2, RotateCcw, ListChecks, Gauge, WandSparkles, CircleCheck,
  CircleAlert, Braces, ExternalLink, Rocket, Globe,
} from 'lucide-react'

/* ────────────────────────────  ДИЗАЙН-ТОКЕНЫ  ──────────────────────────── */

const FONT_DISPLAY = { fontFamily: "'Rubik', 'Onest', system-ui, sans-serif" }
const FONT_BODY = { fontFamily: "'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif" }
const FONT_MONO = { fontFamily: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace" }

// Единственный акцент — тёплый оранжевый (orange-500 #f97316 / orange-600 для текста). Только для AI-помощника, рейтинга и главных действий.
const ACCENT_GLOW = '0 1px 2px rgba(41,37,36,.04), 0 16px 40px -16px rgba(234,88,12,.35)'

// Уровни готовности — семантические цвета, не акцент.
const LEVELS = [
  { min: 90, key: 'priority', label: 'Приоритетная', text: 'text-orange-600', chip: 'text-orange-700 bg-orange-50 border-orange-300', dot: 'bg-orange-500', bar: 'bg-orange-500', note: 'Полностью готова, выделена в каталоге' },
  { min: 70, key: 'ready', label: 'Готовая', text: 'text-emerald-700', chip: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500', note: 'Повышенная позиция в каталоге' },
  { min: 40, key: 'working', label: 'Рабочая', text: 'text-amber-800', chip: 'text-amber-800 bg-amber-50 border-amber-200', dot: 'bg-amber-400', bar: 'bg-amber-400', note: 'Можно откликаться, AI может рекомендовать' },
  { min: 0, key: 'draft', label: 'Черновик', text: 'text-stone-600', chip: 'text-stone-600 bg-stone-100 border-stone-200', dot: 'bg-stone-400', bar: 'bg-stone-300', note: 'Видна в каталоге, требует уточнения' },
]
const levelOf = (s) => LEVELS.find((l) => s >= l.min)

/* ────────────────────────────  РЕЙТИНГ ЗАДАЧИ  ──────────────────────────── */

const CRITERIA = [
  { key: 'context', label: 'Контекст и потребность', weight: 20, icon: Target, how: 'Понятно, что происходит сейчас и что нужно изменить' },
  { key: 'data', label: 'Данные и материалы', weight: 20, icon: Database, how: 'Указаны данные, примеры или источники' },
  { key: 'result', label: 'Ожидаемый результат', weight: 15, icon: Flag, how: 'Описан конкретный результат работы команды' },
  { key: 'criteria', label: 'Критерии успеха', weight: 15, icon: ListChecks, how: 'Есть измеримые признаки принятия решения' },
  { key: 'constraints', label: 'Ограничения', weight: 10, icon: Lock, how: 'Сроки, технологии, доступы или иные границы' },
  { key: 'users', label: 'Пользователи', weight: 10, icon: Users, how: 'Понятно, для кого создаётся решение' },
  { key: 'contact', label: 'Связь с бизнесом', weight: 10, icon: Handshake, how: 'Контакт, формат консультаций, обратная связь' },
]

const CARD_FIELDS = [
  { key: 'context', crit: 'context', label: 'Контекст', ph: 'Что происходит сейчас?', q: 'Что происходит сейчас? Опишите ситуацию и её последствия.' },
  { key: 'need', crit: 'context', label: 'Потребность', ph: 'Что именно нужно изменить?', q: 'Что именно нужно изменить и почему это важно сейчас?' },
  { key: 'users', crit: 'users', label: 'Пользователи', ph: 'Для кого решение?', q: 'Кто будет пользоваться решением каждый день?' },
  { key: 'data', crit: 'data', label: 'Данные и материалы', ph: 'Какие данные вы дадите команде?', q: 'Какие данные, примеры или доступы вы готовы дать команде?' },
  { key: 'constraints', crit: 'constraints', label: 'Ограничения', ph: 'Сроки, технологии, доступы', q: 'Какие сроки, технологии или ограничения нужно учесть?' },
  { key: 'result', crit: 'result', label: 'Ожидаемый результат', ph: 'Что команда сдаёт в конце?', q: 'Что команда должна сдать в конце: прототип, бот, дашборд, отчёт?' },
  { key: 'criteria', crit: 'criteria', label: 'Критерии успеха', ph: 'Измеримо: цифры, %, сроки', q: 'По каким измеримым признакам вы примете решение? Нужны цифры.' },
  { key: 'contact', crit: 'contact', label: 'Контакт', ph: 'Имя, email / телефон / Telegram', q: 'Кто контактное лицо и как с ним связаться?' },
  { key: 'format', crit: 'contact', label: 'Формат взаимодействия', ph: 'Как часто и где консультируете?', q: 'Как часто и в каком формате вы готовы консультировать команду?' },
]

const words = (t) => (t || '').trim().split(/\s+/).filter(Boolean).length
const quality = (t) => { const w = words(t); if (!w) return 0; if (w < 4) return 0.35; if (w < 10) return 0.7; return 1 }
const hasNumber = (t) => /\d/.test(t || '')
const hasContact = (t) => /@|\+?\d[\d\s()-]{6,}|t\.me|telegram|whatsapp/i.test(t || '')

function tipFor(key, card, q) {
  if (q >= 1) return null
  if (key === 'context') return !card.need?.trim() ? 'Опишите, что именно нужно изменить' : 'Добавьте деталей о текущей ситуации'
  if (key === 'criteria' && card.criteria?.trim() && !hasNumber(card.criteria)) return 'Добавьте измеримый показатель: цифру, %, срок'
  if (key === 'contact') {
    if (!hasContact(card.contact)) return 'Укажите контакт: email, телефон или Telegram'
    if (!card.format?.trim()) return 'Укажите формат и частоту консультаций'
  }
  const field = CARD_FIELDS.find((f) => f.crit === key)
  return !card[field.key]?.trim() ? `Заполните «${field.label}»` : 'Опишите подробнее — от 10 слов'
}

/** Прозрачная формула: баллы = вес × качество поля (0 / 0.35 / 0.7 / 1). */
function scoreCard(card) {
  const parts = CRITERIA.map((c) => {
    let q
    if (c.key === 'context') q = (quality(card.context) + quality(card.need)) / 2
    else if (c.key === 'contact') q = Math.min(quality(card.contact), hasContact(card.contact) ? 1 : 0.5) * 0.6 + quality(card.format) * 0.4
    else if (c.key === 'criteria') q = Math.min(quality(card.criteria), hasNumber(card.criteria) ? 1 : 0.6)
    else q = quality(card[c.key])
    const points = Math.round(c.weight * q)
    return { ...c, points, tip: tipFor(c.key, card, points >= c.weight ? 1 : q) }
  })
  return { total: parts.reduce((s, p) => s + p.points, 0), parts }
}

/* ────────────────────────────  AI (локальная заглушка)  ──────────────────────────── */

const AI_PROMPT = `Ты — ассистент платформы Qadam AI. Проанализируй черновик бизнес-задачи.
Верни ТОЛЬКО JSON: {"detected":{<поле>:bool}, "missing":[<поле>], "questions":[{"field":<поле>,"text":<вопрос>}]}
Поля: need, users, data, constraints, result, criteria, contact.
Правила: минимум 3 вопроса; спрашивай о недостающем, от самого весомого;
НЕ добавляй фактов, которых нет в тексте; не заполняй карточку за пользователя.`

const HINTS = {
  users: /клиент|сотрудник|менеджер|пользоват|покупат|студент|врач|водител|оператор/i,
  data: /данн|excel|таблиц|csv|1с|1c|crm|выгрузк|база|отчёт|отчет|истори/i,
  constraints: /срок|недел|месяц|бюджет|python|api|доступ|telegram|до \d/i,
  result: /бот|дашборд|прототип|сайт|приложени|модел|сервис|систем/i,
  criteria: /\d+\s*(%|процент|раз|мин|час|дн)/i,
}

const QUESTION_BANK = {
  need: { w: 20, text: 'Что именно должно измениться после решения? Опишите желаемое состояние.' },
  data: { w: 20, text: 'Какие данные, примеры или доступы вы готовы дать команде?', refine: 'Вы упомянули данные — какие именно, в каком формате и за какой период?' },
  result: { w: 15, text: 'Что команда должна сдать в конце: прототип, бот, дашборд, отчёт?', refine: 'Какой именно результат вы ждёте и в каком виде его примете?' },
  criteria: { w: 15, text: 'По каким измеримым признакам вы поймёте, что решение работает? Нужны цифры.' },
  users: { w: 10, text: 'Кто будет пользоваться решением каждый день?' },
  constraints: { w: 10, text: 'Какие сроки, технологии или ограничения нужно учесть?' },
  contact: { w: 10, text: 'Кто контактное лицо, как связаться и как часто вы готовы консультировать?' },
}

function analyzeDraft(draft) {
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
    questions: qs.map((field) => ({ field, text: detected[field] && QUESTION_BANK[field].refine ? QUESTION_BANK[field].refine : QUESTION_BANK[field].text })),
  }
}

/** Обработка некорректного ответа модели: невалидный JSON / <3 вопросов → шаблонные вопросы. */
function validateAIResponse(raw) {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    const ok = Array.isArray(obj?.questions) && obj.questions.length >= 3 && obj.questions.every((q) => QUESTION_BANK[q.field] && q.text)
    if (!ok) throw new Error('schema')
    return { ok: true, data: obj }
  } catch {
    return { ok: false, data: { detected: {}, missing: ['need', 'data', 'result'], questions: ['need', 'data', 'result'].map((f) => ({ field: f, text: QUESTION_BANK[f].text })) } }
  }
}

/* ────────────────────────────  СИНТЕТИЧЕСКИЕ ДАННЫЕ  ──────────────────────────── */

const INDUSTRIES = ['Ритейл', 'Логистика', 'Услуги', 'Финансы', 'HoReCa', 'Образование']
const MY_COMPANY = 'Qala Service'

const SEED_DRAFTS = [
  { industry: 'Услуги', text: 'Нужен бот для записи клиентов в наш салон' },
  { industry: 'Ритейл', text: 'Хотим понять, почему клиенты перестают возвращаться' },
  { industry: 'Финансы', text: 'Автоматизировать отчёты по продажам, сейчас всё вручную в Excel' },
  { industry: 'Услуги', text: 'Сделать сайт для приёма заявок на ремонт техники' },
  { industry: 'Логистика', text: 'Товары на складе часто заканчиваются, есть выгрузки из 1С, нужна аналитика' },
]

const SEED_TASKS = [
  {
    id: 't1', company: 'Dala Logistics', industry: 'Логистика', tags: ['Python', 'Аналитика', 'ML'], createdAt: 5,
    title: 'Прогноз остатков на складе по выгрузкам 1С',
    context: 'На трёх складах в Алматы товары регулярно заканчиваются раньше поставки, закупщики считают потребность вручную в Excel раз в неделю.',
    need: 'Нужен инструмент, который заранее показывает, какие позиции закончатся в ближайшие две недели, чтобы закупщики успевали сделать заказ.',
    users: 'Три закупщика и руководитель склада, которые каждое утро планируют заказы поставщикам.',
    data: 'Выгрузки продаж и остатков из 1С за 2 года в CSV, около 4 000 SKU, справочник поставщиков со сроками поставки.',
    constraints: 'Срок 6 недель, Python или любой BI, доступ только к обезличенным выгрузкам, без подключения к боевой 1С.',
    result: 'Дашборд с прогнозом дефицита по SKU на 14 дней и еженедельный список рекомендуемых заказов.',
    criteria: 'Точность прогноза не ниже 80% на отложенной выборке, число дефицитных позиций снижается на 30% за месяц пилота.',
    contact: 'Айгерим, руководитель склада, a.nurlanova@dala.kz, +7 701 000 00 00',
    format: 'Созвон раз в неделю по вторникам, ответы в Telegram в течение дня, демо каждые две недели.',
  },
  {
    id: 't2', company: 'Taza Market', industry: 'Ритейл', tags: ['Аналитика', 'SQL', 'Дашборд'], createdAt: 4,
    title: 'Почему покупатели перестают возвращаться',
    context: 'Сеть из 12 магазинов у дома, за полгода доля повторных покупок по картам лояльности упала.',
    need: 'Понять причины оттока и получить сегменты клиентов, которых можно вернуть акциями.',
    users: 'Маркетолог сети и управляющие магазинами.',
    data: 'Чеки по картам лояльности за 18 месяцев, обезличенные, выгрузка из CRM в Excel.',
    constraints: 'Срок 4 недели, данные не покидают ноутбук компании.',
    result: 'Отчёт с сегментами оттока и дашборд удержания.',
    criteria: 'Сегменты объясняют причины оттока, маркетолог может запустить акцию по ним.',
    contact: 'Данияр, маркетинг',
    format: 'Встречи по запросу.',
  },
  {
    id: 't3', company: MY_COMPANY, industry: 'Услуги', tags: ['Web', 'React', 'Telegram'], createdAt: 3, owner: true,
    title: 'Онлайн-заявки на ремонт техники вместо звонков',
    context: 'Сервисный центр принимает заявки только по телефону, в часы пик до трети звонков остаются без ответа.',
    need: 'Клиент должен оставлять заявку сам, а мастер — видеть очередь и статус ремонта.',
    users: 'Клиенты сервисного центра и четыре мастера-приёмщика.',
    data: 'Прайс на 60 видов работ, пример журнала заявок в Google Sheets за месяц.',
    constraints: 'Срок 5 недель, без платных сервисов, интеграция с Telegram желательна.',
    result: 'Веб-форма заявки и простая панель мастера со статусами.',
    criteria: 'Не менее 40% заявок приходит онлайн в первый месяц, время обработки заявки до 15 минут.',
    contact: 'Айжан, управляющая, info@qalaservice.kz',
    format: 'Созвон раз в неделю.',
  },
  {
    id: 't4', company: 'Arna Fitness', industry: 'Услуги', tags: ['Telegram', 'Бот'], createdAt: 2,
    title: 'Бот для записи на тренировки',
    context: 'Администратор записывает клиентов вручную через WhatsApp.',
    need: 'Автоматизировать запись.',
    users: 'Клиенты клуба.',
    data: 'Расписание тренировок в Google Sheets.', constraints: 'Срок месяц.', result: 'Telegram-бот.',
    criteria: 'Администратор тратит на запись меньше 1 часа в день.', contact: '', format: '',
  },
  {
    id: 't5', company: 'Nomad Coffee', industry: 'HoReCa', tags: ['Аналитика'], createdAt: 1,
    title: 'Сократить списания выпечки',
    context: 'Каждый вечер выбрасываем много выпечки.',
    need: '', users: '', data: 'Есть продажи из кассы.', constraints: '', result: '', criteria: '', contact: '', format: '',
  },
]

const SEED_TEAMS = [
  { id: 'k1', name: 'Byte Nomads', captain: 'Айдана', members: 4, skills: ['React', 'Web', 'Node.js'], interests: ['Услуги', 'Ритейл'], points: 120 },
  { id: 'k2', name: 'Steppe AI', captain: 'Тимур', members: 3, skills: ['Python', 'ML', 'Аналитика'], interests: ['Логистика', 'Финансы'], points: 180 },
  { id: 'k3', name: 'Data Batyrs', captain: 'Ерлан', members: 5, skills: ['SQL', 'Аналитика', 'Дашборд'], interests: ['Ритейл', 'HoReCa'], points: 90 },
  { id: 'k4', name: 'Qazaq Devs', captain: 'Мадина', members: 3, skills: ['Telegram', 'Бот', 'Python'], interests: ['Услуги', 'Образование'], points: 60 },
  { id: 'k5', name: 'Pixel Qanat', captain: 'Алихан', members: 4, skills: ['Web', 'React', 'Figma'], interests: ['HoReCa', 'Услуги'], points: 40 },
]

const SEED_PROPOSALS = [
  { id: 'p1', taskId: 't3', teamId: 'k1', status: 'pending', idea: 'PWA с формой заявки, выбором услуги из прайса и статусами ремонта для клиента по ссылке.', plan: 'Неделя 1 — форма и прайс; 2–3 — панель мастера; 4 — Telegram-уведомления; 5 — пилот.', deadline: '5 недель', link: 'https://github.com/byte-nomads/qala-repair' },
  { id: 'p2', taskId: 't3', teamId: 'k4', status: 'pending', idea: 'Telegram-бот для заявок: клиент выбирает услугу, бот создаёт карточку в Google Sheets мастера.', plan: 'Неделя 1 — сценарии бота; 2 — интеграция с Sheets; 3 — статусы; 4 — тест с мастерами.', deadline: '4 недели', link: 'https://github.com/qazaq-devs/repair-bot' },
  { id: 'p3', taskId: 't3', teamId: 'k5', status: 'pending', idea: 'Лендинг с формой заявки и калькулятором стоимости ремонта по прайсу.', plan: 'Неделя 1 — дизайн; 2 — вёрстка; 3 — форма и калькулятор; 4 — запуск.', deadline: '4 недели', link: 'https://figma.com/@pixel-qanat/qala' },
  { id: 'p4', taskId: 't1', teamId: 'k2', status: 'pending', idea: 'Модель прогноза спроса на LightGBM и дашборд дефицита по SKU на 14 дней.', plan: 'Неделя 1–2 — EDA и признаки; 3–4 — модель; 5 — дашборд; 6 — пилот.', deadline: '6 недель', link: 'https://github.com/steppe-ai/dala-forecast' },
  { id: 'p5', taskId: 't2', teamId: 'k3', status: 'pending', idea: 'RFM-сегментация и когортный анализ удержания с дашбордом в Metabase.', plan: 'Неделя 1 — очистка чеков; 2 — RFM; 3 — когорты; 4 — дашборд и выводы.', deadline: '4 недели', link: 'https://github.com/data-batyrs/taza-churn' },
]

// Цвет аватара команды — только для узнаваемости, не акцент
const TEAM_TINT = { k1: 'bg-rose-100 text-rose-700', k2: 'bg-sky-100 text-sky-700', k3: 'bg-amber-100 text-amber-800', k4: 'bg-emerald-100 text-emerald-700', k5: 'bg-violet-100 text-violet-700' }

function Avatar({ team, size = 'md' }) {
  const s = size === 'sm' ? 'size-7 text-[11px]' : 'size-11 text-sm'
  return <div className={cx('grid shrink-0 place-items-center rounded-full font-semibold', s, TEAM_TINT[team.id] || 'bg-stone-100 text-stone-700')} style={FONT_DISPLAY}>{team.captain?.[0] || team.name[0]}</div>
}

const EMPTY_CARD = { title: '', industry: 'Услуги', context: '', need: '', users: '', data: '', constraints: '', result: '', criteria: '', contact: '', format: '' }

const SCENARIO = ['Черновик', 'Уточнение', 'Карточка', 'Рейтинг', 'Каталог', 'Отклик команды', 'Выбор бизнеса', 'Результат']

/* ────────────────────────────  UI-ПРИМИТИВЫ  ──────────────────────────── */

const cx = (...a) => a.filter(Boolean).join(' ')

function Button({ variant = 'ghost', size = 'md', className, children, ...props }) {
  const v = {
    primary: 'bg-orange-500 text-white hover:bg-orange-600 font-semibold shadow-[0_8px_20px_-8px_rgba(234,88,12,.55)] disabled:bg-stone-100 disabled:text-stone-500 disabled:shadow-none',
    ghost: 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 hover:border-stone-300',
    quiet: 'text-stone-500 hover:text-stone-900 hover:bg-stone-100',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
    danger: 'text-stone-500 border border-stone-200 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50',
  }[variant]
  const s = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-sm gap-2' }[size]
  return (
    <button className={cx('inline-flex items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60', v, s, className)} {...props}>
      {children}
    </button>
  )
}

function Panel({ className, glow, children }) {
  return (
    <div className={cx('rounded-3xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(41,37,36,.04),0_12px_32px_-20px_rgba(41,37,36,.18)]', className)} style={glow ? { boxShadow: ACCENT_GLOW } : undefined}>
      {children}
    </div>
  )
}

function LevelChip({ score, className }) {
  const l = levelOf(score)
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium', l.chip, className)}>
      <span className={cx('size-1.5 rounded-full', l.dot)} />
      {l.label}
    </span>
  )
}

function ScoreRing({ score, size = 160, stroke = 12, label = true }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const l = levelOf(score)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ece8e4" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f97316" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)', filter: 'drop-shadow(0 4px 10px rgba(234,88,12,.25))' }} />
        {[40, 70, 90].map((t) => (
          <circle key={t} cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff" strokeWidth={stroke + 1}
            strokeDasharray={`1.5 ${c}`} strokeDashoffset={-(c * t) / 100} />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular-nums text-stone-900 leading-none" style={{ ...FONT_DISPLAY, fontSize: size * 0.27, fontWeight: 600 }}>{score}</span>
        {label && <span className={cx('mt-1.5 text-[11px] uppercase tracking-[0.14em]', l.text)}>{l.label}</span>}
      </div>
    </div>
  )
}

function MiniRing({ score, size = 44 }) {
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const l = levelOf(score)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ece8e4" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
          className={cx(l.key === 'priority' ? 'stroke-orange-500' : l.key === 'ready' ? 'stroke-emerald-500' : l.key === 'working' ? 'stroke-amber-400' : 'stroke-stone-300')} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums text-stone-900" style={FONT_MONO}>{score}</span>
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-stone-500">{label}{hint}</span>
      {children}
    </label>
  )
}

const inputCls = 'w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/15'

/* ────────────────────────────  ЯЗЫКИ (ҚАЗ / РУС / ENG)  ──────────────────────────── */
// Переводится интерфейс. Содержимое задач и откликов — на языке автора, не переводится.
const LANGS = [
  { code: 'kk', short: 'ҚАЗ', name: 'Қазақша' },
  { code: 'ru', short: 'РУС', name: 'Русский' },
  { code: 'en', short: 'ENG', name: 'English' },
]

const I18N = {
  ru: {
    tagline: 'бизнес и студенты — шаг навстречу', business: 'Бизнес', students: 'Студенты', youTeam: 'Вы — команда',
    navNew: 'Новая задача', navCatalog: 'Каталог', navInbox: 'Отклики', navMine: 'Наши отклики',
    howAI: 'Как работает AI', reset: 'Сбросить демо', language: 'Язык', menu: 'Меню',
    bEyebrow: 'Новая задача', bTitle: 'Расскажите, что хотите решить',
    bSub: 'Пишите как есть, своими словами. Помощник задаст пару вопросов и соберёт карточку. Чем понятнее задача, тем выше она в каталоге и тем сильнее команды откликнутся.',
    step1: 'Ваша задача', step2: 'Пара вопросов', step3: 'Карточка',
    goAssistant: 'Продолжить с помощником', reading: 'Помощник читает…', buildCard: 'Собрать карточку', publish: 'Опубликовать', points: 'баллов',
    cEyebrow: 'Каталог', cTitle: 'Задачи, которые ждут команду', cSub: 'Все задачи открыты для всех команд. Порядок определяет рейтинг готовности, а не известность компании.',
    pEyebrow: 'Отклики', pTitle: 'Кто хочет взяться за задачу', pSub: 'Познакомьтесь с командами и выберите одну, несколько или никого. Решаете только вы.',
    mEyebrow: 'Команда', mTitle: 'Наши отклики', mSub: 'Здесь видно, что ответил бизнес. Баллы приходят, когда бизнес подтвердит этап работы.',
    score: 'Рейтинг готовности', breakdown: 'Из чего складывается', raise: 'Что поднимет рейтинг', growth: 'Рост рейтинга', fromDraft: 'баллов с черновика',
    flow: 'Сквозной сценарий', now: 'сейчас',
    s0: 'Черновик', s1: 'Уточнение', s2: 'Карточка', s3: 'Рейтинг', s4: 'Каталог', s5: 'Отклик команды', s6: 'Выбор бизнеса', s7: 'Результат',
  },
  kk: {
    tagline: 'бизнес пен студенттер — бір-біріне бір қадам', business: 'Бизнес', students: 'Студенттер', youTeam: 'Сіздің командаңыз',
    navNew: 'Жаңа тапсырма', navCatalog: 'Каталог', navInbox: 'Өтінімдер', navMine: 'Біздің өтінімдер',
    howAI: 'AI қалай жұмыс істейді', reset: 'Демоны қайта бастау', language: 'Тіл', menu: 'Мәзір',
    bEyebrow: 'Жаңа тапсырма', bTitle: 'Нені шешкіңіз келетінін айтыңыз',
    bSub: 'Өз сөзіңізбен, қалай бар солай жазыңыз. Көмекші бірнеше сұрақ қойып, карточканы жинайды. Тапсырма неғұрлым түсінікті болса, каталогта соғұрлым жоғары тұрады.',
    step1: 'Сіздің тапсырмаңыз', step2: 'Бірнеше сұрақ', step3: 'Карточка',
    goAssistant: 'Көмекшімен жалғастыру', reading: 'Көмекші оқып жатыр…', buildCard: 'Карточканы жинау', publish: 'Жариялау', points: 'ұпай',
    cEyebrow: 'Каталог', cTitle: 'Команда күтіп тұрған тапсырмалар', cSub: 'Барлық тапсырма барлық командаға ашық. Ретті компанияның танымалдығы емес, дайындық рейтингі анықтайды.',
    pEyebrow: 'Өтінімдер', pTitle: 'Тапсырманы кім алғысы келеді', pSub: 'Командалармен танысып, біреуін, бірнешеуін таңдаңыз немесе ешкімді таңдамаңыз. Шешімді тек сіз қабылдайсыз.',
    mEyebrow: 'Команда', mTitle: 'Біздің өтінімдер', mSub: 'Бизнестің жауабы осында көрінеді. Бизнес жұмыс кезеңін растағанда ұпай беріледі.',
    score: 'Дайындық рейтингі', breakdown: 'Неден құралады', raise: 'Рейтингті не көтереді', growth: 'Рейтинг өсімі', fromDraft: 'ұпай жобадан бері',
    flow: 'Толық сценарий', now: 'қазір',
    s0: 'Жоба', s1: 'Нақтылау', s2: 'Карточка', s3: 'Рейтинг', s4: 'Каталог', s5: 'Команда өтінімі', s6: 'Бизнес таңдауы', s7: 'Нәтиже',
  },
  en: {
    tagline: 'business and students, one step closer', business: 'Business', students: 'Students', youTeam: 'Your team',
    navNew: 'New task', navCatalog: 'Catalog', navInbox: 'Proposals', navMine: 'Our proposals',
    howAI: 'How the AI works', reset: 'Reset demo', language: 'Language', menu: 'Menu',
    bEyebrow: 'New task', bTitle: 'Tell us what you want to solve',
    bSub: 'Write it in your own words. The assistant will ask a few questions and build the card. The clearer the task, the higher it ranks and the stronger the teams it attracts.',
    step1: 'Your task', step2: 'A few questions', step3: 'Card',
    goAssistant: 'Continue with the assistant', reading: 'The assistant is reading…', buildCard: 'Build the card', publish: 'Publish', points: 'points',
    cEyebrow: 'Catalog', cTitle: 'Tasks waiting for a team', cSub: 'Every task is open to every team. The order comes from the readiness score, not from how famous the company is.',
    pEyebrow: 'Proposals', pTitle: 'Who wants to take this on', pSub: 'Meet the teams and pick one, several or none. Only you decide.',
    mEyebrow: 'Team', mTitle: 'Our proposals', mSub: 'See what the business replied. Points arrive once the business confirms a work stage.',
    score: 'Readiness score', breakdown: 'What it’s made of', raise: 'What will raise the score', growth: 'Score growth', fromDraft: 'points since the draft',
    flow: 'End-to-end flow', now: 'now',
    s0: 'Draft', s1: 'Clarify', s2: 'Card', s3: 'Score', s4: 'Catalog', s5: 'Team proposal', s6: 'Business choice', s7: 'Result',
  },
}

const LangCtx = createContext((k) => I18N.ru[k] ?? k)
const useT = () => useContext(LangCtx)

/** Desktop: сегмент в сайдбаре. */
function LangSwitch({ lang, onChange, className }) {
  const t = useT()
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] uppercase tracking-[0.12em] text-stone-500"><Globe className="size-3.5" />{t('language')}</div>
      <div role="radiogroup" aria-label={t('language')} className="grid grid-cols-3 rounded-full border border-stone-200 bg-stone-100/70 p-1">
        {LANGS.map((l) => (
          <button key={l.code} role="radio" aria-checked={lang === l.code} title={l.name} onClick={() => onChange(l.code)}
            className={cx('h-7 rounded-full text-[11px] font-semibold tracking-wide transition', lang === l.code ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800')}>
            {l.short}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Mobile: кнопка «🌐 РУС» в шапке открывает нижнюю шторку-меню. */
function MobileMenu({ lang, onLang, onAI, onReset, onClose }) {
  const t = useT()
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:hidden">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="q-in relative w-full rounded-t-3xl border-t border-stone-200 bg-white px-4 pt-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
        <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] uppercase tracking-[0.12em] text-stone-500"><Globe className="size-3.5" />{t('language')}</div>
        <div className="space-y-1">
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => { onLang(l.code); onClose() }}
              className={cx('flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] transition', lang === l.code ? 'bg-orange-50 text-stone-900' : 'text-stone-700 hover:bg-stone-100')}>
              <span>{l.name}</span>
              <span className="flex items-center gap-2 text-xs text-stone-500">{l.short}{lang === l.code && <Check className="size-4 text-orange-600" />}</span>
            </button>
          ))}
        </div>
        <div className="my-3 h-px bg-stone-200" />
        <button onClick={() => { onAI(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-100"><Braces className="size-4 text-orange-600" />{t('howAI')}</button>
        <button onClick={() => { onReset(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-stone-500 hover:bg-stone-100"><RotateCcw className="size-4" />{t('reset')}</button>
      </div>
    </div>
  )
}

/* ────────────────────────────  ПРИЛОЖЕНИЕ  ──────────────────────────── */

export default function QadamPrototype() {
  const [role, setRole] = useState('business') // business | student
  const [view, setView] = useState('builder') // builder | catalog | proposals | mine
  const [tasks, setTasks] = useState(SEED_TASKS)
  const [teams, setTeams] = useState(SEED_TEAMS)
  const [proposals, setProposals] = useState(SEED_PROPOSALS)
  const [teamId, setTeamId] = useState('k1')
  const [toast, setToast] = useState(null)
  const [openTaskId, setOpenTaskId] = useState(null)
  const [aiModal, setAiModal] = useState(false)
  const [lang, setLang] = useState('ru') // kk | ru | en — в проде хранить в localStorage
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useMemo(() => (k) => I18N[lang][k] ?? I18N.ru[k] ?? k, [lang])
  useEffect(() => { document.documentElement.lang = lang }, [lang])

  // Конструктор
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState('')
  const [industry, setIndustry] = useState('Услуги')
  const [ai, setAi] = useState(null) // { raw, valid, data }
  const [thinking, setThinking] = useState(false)
  const [answers, setAnswers] = useState({})
  const [card, setCard] = useState(EMPTY_CARD)
  const [confirmed, setConfirmed] = useState(false)
  const [history, setHistory] = useState([])
  const [newTaskId, setNewTaskId] = useState(null)
  const [growth, setGrowth] = useState([])
  const [milestones, setMilestones] = useState({})

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t) }, [toast])

  const scored = useMemo(() => tasks.map((t) => ({ ...t, score: scoreCard(t).total })), [tasks])
  const ranked = useMemo(() => [...scored].sort((a, b) => b.score - a.score || b.createdAt - a.createdAt), [scored])

  // Живой рейтинг в конструкторе: на шаге 2 — черновик + ответы, на шаге 3 — карточка
  const liveCard = useMemo(() => {
    if (step === 3) return card
    const c = { ...EMPTY_CARD, context: draft }
    if (step === 2) Object.entries(answers).forEach(([f, v]) => { c[f === 'need' ? 'need' : f] = v })
    return c
  }, [step, card, draft, answers])
  const live = useMemo(() => scoreCard(liveCard), [liveCard])

  const myTeam = teams.find((t) => t.id === teamId)
  const myTaskIds = tasks.filter((t) => t.owner).map((t) => t.id)
  const pendingForMe = proposals.filter((p) => myTaskIds.includes(p.taskId) && p.status === 'pending').length

  const flowTask = newTaskId || null
  const flowProps = proposals.filter((p) => p.taskId === flowTask)
  const done = [
    draft.trim().length > 0 || !!newTaskId,
    !!ai || !!newTaskId,
    step === 3 || !!newTaskId,
    confirmed || !!newTaskId,
    !!newTaskId,
    flowProps.length > 0,
    flowProps.some((p) => p.status !== 'pending'),
    flowProps.some((p) => milestones[p.id]),
  ]
  const currentStep = done.findIndex((d) => !d)

  /* ── действия ── */

  const runAnalysis = () => {
    if (words(draft) < 3) { setToast({ tone: 'warn', text: 'Опишите задачу хотя бы в трёх словах' }); return }
    setThinking(true)
    setTimeout(() => {
      const raw = JSON.stringify(analyzeDraft(draft))
      const v = validateAIResponse(raw)
      setAi({ raw, valid: v.ok, data: v.data })
      setAnswers({})
      setHistory([{ label: 'Черновик', score: scoreCard({ ...EMPTY_CARD, context: draft }).total }])
      setThinking(false)
      setStep(2)
    }, 1100)
  }

  const buildCard = () => {
    const c = { ...EMPTY_CARD, industry, context: draft.trim() }
    Object.entries(answers).forEach(([f, v]) => { if (v.trim()) c[f] = v.trim() })
    const first = draft.trim().split(/[.!?\n]/)[0]
    c.title = first.length > 70 ? first.slice(0, 67) + '…' : first
    c.title = c.title.charAt(0).toUpperCase() + c.title.slice(1)
    setCard(c)
    setHistory((h) => [...h.slice(0, 1), { label: 'Ответы', score: scoreCard(c).total }])
    setConfirmed(false)
    setStep(3)
  }

  const publish = () => {
    if (!card.title.trim()) { setToast({ tone: 'warn', text: 'Добавьте название задачи' }); return }
    if (!confirmed) { setToast({ tone: 'warn', text: 'Подтвердите карточку перед публикацией' }); return }
    const id = 'n' + Date.now()
    const text = Object.values(card).join(' ')
    const tags = [
      ...(/бот|telegram/i.test(text) ? ['Telegram', 'Бот'] : []),
      ...(/сайт|веб|web|форм|заявк/i.test(text) ? ['Web', 'React'] : []),
      ...(/данн|аналит|excel|1с|отчёт/i.test(text) ? ['Аналитика'] : []),
    ]
    const task = { ...card, id, company: MY_COMPANY, owner: true, tags: tags.length ? tags : ['Web'], createdAt: 10, isNew: true }
    const s = scoreCard(card).total
    setGrowth([...history.slice(0, 2), { label: 'Публикация', score: s }])
    setStep(1); setDraft(''); setAi(null); setAnswers({}); setCard(EMPTY_CARD); setConfirmed(false); setHistory([])
    setTasks((ts) => [...ts.map((t) => ({ ...t, isNew: false })), task])
    setNewTaskId(id)
    const pos = [...scored, { ...task, score: s }].sort((a, b) => b.score - a.score || b.createdAt - a.createdAt).findIndex((t) => t.id === id) + 1
    setToast({ tone: 'ok', text: `Опубликовано · позиция #${pos} в каталоге` })
    setView('catalog')
  }

  const resetBuilder = () => { setStep(1); setDraft(''); setAi(null); setAnswers({}); setCard(EMPTY_CARD); setConfirmed(false); setHistory([]) }
  const resetDemo = () => {
    resetBuilder(); setTasks(SEED_TASKS); setProposals(SEED_PROPOSALS); setTeams(SEED_TEAMS); setNewTaskId(null); setMilestones({}); setGrowth([])
    setRole('business'); setView('builder'); setToast({ tone: 'ok', text: 'Демо сброшено' })
  }

  const submitProposal = (taskId, form) => {
    setProposals((ps) => [...ps, { id: 'p' + Date.now(), taskId, teamId, status: 'pending', ...form }])
    setToast({ tone: 'ok', text: 'Отклик отправлен — бизнес увидит его во «Входящих»' })
  }
  const decide = (pid, status) => {
    setProposals((ps) => ps.map((p) => (p.id === pid ? { ...p, status } : p)))
    setToast({ tone: status === 'accepted' ? 'ok' : 'neutral', text: status === 'accepted' ? 'Команда выбрана' : 'Отклик отклонён' })
  }
  const confirmMilestone = (p) => {
    setMilestones((m) => ({ ...m, [p.id]: true }))
    setTeams((ts) => ts.map((t) => (t.id === p.teamId ? { ...t, points: t.points + 50 } : t)))
    setToast({ tone: 'ok', text: '+50 баллов команде за подтверждённый этап' })
  }

  const switchRole = (r) => { setRole(r); setView(r === 'business' ? 'builder' : 'catalog'); setOpenTaskId(null) }

  const nav = role === 'business'
    ? [{ id: 'builder', label: t('navNew'), icon: PenLine }, { id: 'catalog', label: t('navCatalog'), icon: LayoutGrid }, { id: 'proposals', label: t('navInbox'), icon: Inbox, badge: pendingForMe }]
    : [{ id: 'catalog', label: t('navCatalog'), icon: LayoutGrid }, { id: 'mine', label: t('navMine'), icon: Send, badge: proposals.filter((p) => p.teamId === teamId).length }]

  const openTask = scored.find((t) => t.id === openTaskId)

  return (
    <LangCtx.Provider value={t}>
    <div className="min-h-screen bg-[#F6F4F1] text-stone-700 antialiased selection:bg-orange-200" style={FONT_BODY}>
      <style>{`
        @keyframes q-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes q-shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        .q-in { animation: q-in .35s cubic-bezier(.2,.8,.2,1) both }
        .q-shimmer { background: linear-gradient(90deg, #efebe7 25%, #fde5d4 50%, #efebe7 75%); background-size: 200% 100%; animation: q-shimmer 1.4s linear infinite }
        @media (prefers-reduced-motion: reduce) { .q-in, .q-shimmer { animation: none } }
      `}</style>

      {/* Фоновое свечение */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/4 h-[520px] w-[520px] rounded-full bg-orange-200/40 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full bg-sky-200/40 blur-[140px]" />
      </div>

      <div className="relative flex min-h-screen">
        {/* ── Sidebar (desktop) ── */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-stone-200 bg-white/80 px-4 py-5 backdrop-blur-xl lg:flex">
          <Brand />
          <RoleSwitch role={role} onChange={switchRole} className="mt-6" />
          <nav className="mt-6 space-y-1">
            {nav.map((n) => (
              <button key={n.id} onClick={() => { setView(n.id); setOpenTaskId(null) }}
                className={cx('group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                  view === n.id ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:bg-stone-100/70 hover:text-stone-900')}>
                <n.icon className={cx('size-4', view === n.id ? 'text-orange-600' : 'text-stone-500 group-hover:text-stone-700')} />
                {n.label}
                {!!n.badge && <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-600 tabular-nums">{n.badge}</span>}
              </button>
            ))}
          </nav>
          {role === 'student' ? <TeamPicker teams={teams} teamId={teamId} onChange={setTeamId} className="mt-6" /> : (
            <div className="mt-6 flex items-center gap-3 rounded-3xl border border-stone-200 bg-white p-3">
              <div className="grid size-10 place-items-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700" style={FONT_DISPLAY}>А</div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-900">Айжан</div>
                <div className="truncate text-xs text-stone-500">управляющая, {MY_COMPANY}</div>
              </div>
            </div>
          )}
          <div className="mt-auto space-y-3">
            <LangSwitch lang={lang} onChange={setLang} className="mb-4" />
            <button onClick={() => setAiModal(true)} className="flex w-full items-center gap-2.5 rounded-xl border border-stone-200 px-3 py-2.5 text-left text-xs text-stone-500 transition hover:border-orange-300 hover:text-stone-900">
              <Braces className="size-4 text-orange-600" /> {t('howAI')}
            </button>
            <button onClick={resetDemo} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-stone-500 transition hover:text-stone-800">
              <RotateCcw className="size-3.5" /> {t('reset')}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ── Topbar (mobile) ── */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/85 px-4 py-3 backdrop-blur-xl lg:hidden">
            <Brand compact />
            <div className="flex items-center gap-2">
              <RoleSwitch role={role} onChange={switchRole} compact />
              <button onClick={() => setMenuOpen(true)} aria-label={`${t('language')} · ${t('menu')}`}
                className="flex h-9 items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 text-[11px] font-semibold text-stone-700">
                <Globe className="size-4 text-orange-600" />{LANGS.find((l) => l.code === lang).short}
              </button>
            </div>
          </header>

          <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
            {/* ── Main ── */}
            <main className="min-w-0 flex-1 px-4 pb-6 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
              {role === 'student' && <TeamPicker teams={teams} teamId={teamId} onChange={setTeamId} className="mb-5 lg:hidden" compact />}

              {view === 'builder' && (
                <Builder {...{ step, setStep, draft, setDraft, industry, setIndustry, ai, thinking, runAnalysis, answers, setAnswers, buildCard, card, setCard, confirmed, setConfirmed, publish, live, resetBuilder }} />
              )}
              {view === 'catalog' && (
                <Catalog tasks={ranked} proposals={proposals} role={role} team={myTeam} onOpen={setOpenTaskId} />
              )}
              {view === 'proposals' && (
                <Proposals tasks={scored.filter((t) => t.owner)} proposals={proposals} teams={teams} milestones={milestones} onDecide={decide} onMilestone={confirmMilestone} newTaskId={newTaskId} />
              )}
              {view === 'mine' && (
                <MyProposals proposals={proposals.filter((p) => p.teamId === teamId)} tasks={scored} milestones={milestones} onOpen={setOpenTaskId} />
              )}
            </main>

            {/* ── Wow-панель ── */}
            <aside className="w-full shrink-0 space-y-4 border-stone-200 px-4 pb-28 sm:px-6 lg:px-8 xl:sticky xl:top-0 xl:h-screen lg:pb-10 xl:w-[360px] xl:overflow-y-auto xl:border-l xl:px-5 xl:py-8">
              {view === 'builder' ? (
                <RatingPanel live={live} history={history} step={step} />
              ) : (
                <ImpactPanel tasks={scored} proposals={proposals} teams={teams} role={role} teamId={teamId} history={growth} />
              )}
              <ScenarioTracker done={done} current={currentStep} />
            </aside>
          </div>
        </div>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-xl lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto flex max-w-md">
          {nav.map((n) => (
            <button key={n.id} onClick={() => { setView(n.id); setOpenTaskId(null) }}
              className={cx('relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]', view === n.id ? 'text-orange-600' : 'text-stone-500')}>
              <n.icon className="size-5" />
              {n.label}
              {!!n.badge && <span className="absolute right-[calc(50%-22px)] top-1.5 grid min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">{n.badge}</span>}
            </button>
          ))}
        </div>
      </nav>

      {openTask && (
        <TaskDrawer task={openTask} role={role} team={myTeam} proposals={proposals} onClose={() => setOpenTaskId(null)}
          onSubmit={submitProposal} onGoInbox={() => { setOpenTaskId(null); setView('proposals') }} />
      )}
      {aiModal && <AIModal ai={ai} draft={draft} onClose={() => setAiModal(false)} />}
      {toast && <Toast {...toast} />}
      {menuOpen && <MobileMenu lang={lang} onLang={setLang} onAI={() => setAiModal(true)} onReset={resetDemo} onClose={() => setMenuOpen(false)} />}
    </div>
    </LangCtx.Provider>
  )
}

/* ────────────────────────────  ОБОЛОЧКА  ──────────────────────────── */

function Brand({ compact }) {
  const t = useT()
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl bg-orange-500 text-white" style={{ boxShadow: '0 8px 20px -8px rgba(234,88,12,.6)' }}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18h5v-5h5V8h6" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] text-stone-900" style={{ ...FONT_DISPLAY, fontWeight: 600 }}>Qadam<span className="text-orange-600"> AI</span></div>
        {!compact && <div className="text-[11px] text-stone-500">{t('tagline')}</div>}
      </div>
    </div>
  )
}

function RoleSwitch({ role, onChange, compact, className }) {
  const t = useT()
  const items = [{ id: 'business', label: t('business'), icon: Briefcase }, { id: 'student', label: t('students'), icon: GraduationCap }]
  return (
    <div className={cx('grid grid-cols-2 rounded-xl border border-stone-200 bg-white p-1', className)}>
      {items.map((i) => (
        <button key={i.id} onClick={() => onChange(i.id)} aria-pressed={role === i.id}
          className={cx('flex items-center justify-center gap-1.5 rounded-lg font-medium transition', compact ? 'h-7 px-2.5 text-xs' : 'h-8 text-xs',
            role === i.id ? 'bg-stone-100 text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800')}>
          <i.icon className="size-3.5" />{i.label}
        </button>
      ))}
    </div>
  )
}

function TeamPicker({ teams, teamId, onChange, className, compact }) {
  const tr = useT()
  const t = teams.find((x) => x.id === teamId)
  return (
    <div className={cx('rounded-xl border border-stone-200 bg-white p-3', className)}>
      <label htmlFor={compact ? 'team-m' : 'team'} className="text-[11px] uppercase tracking-[0.12em] text-stone-500">{tr('youTeam')}</label>
      <select id={compact ? 'team-m' : 'team'} value={teamId} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm font-medium text-stone-900 outline-none">
        {teams.map((x) => <option key={x.id} value={x.id} className="bg-white">{x.name}</option>)}
      </select>
      <div className="mt-2 flex flex-wrap gap-1">
        {t.skills.map((s) => <span key={s} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">{s}</span>)}
      </div>
    </div>
  )
}

function PageHead({ eyebrow, title, sub, right }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-orange-600">{eyebrow}</div>}
        <h1 className="text-2xl text-stone-900 sm:text-[28px]" style={{ ...FONT_DISPLAY, fontWeight: 600, letterSpacing: '-0.015em', textWrap: 'balance' }}>{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-sm text-stone-500">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

/* ────────────────────────────  КОНСТРУКТОР  ──────────────────────────── */

function AssistantBubble({ children, compact }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-orange-500 text-white shadow-[0_6px_16px_-8px_rgba(234,88,12,.7)]">
        <Sparkles className="size-4" />
      </div>
      <div className={cx('max-w-[85%] rounded-3xl rounded-tl-md border border-stone-200 bg-white text-sm leading-relaxed text-stone-600 shadow-[0_1px_2px_rgba(41,37,36,.04),0_8px_24px_-16px_rgba(41,37,36,.18)]', compact ? 'px-4 py-3' : 'px-4 py-3.5')}>
        {!compact && <div className="mb-1 text-xs font-medium text-orange-600">Помощник Qadam</div>}
        {children}
      </div>
    </div>
  )
}

function Builder(p) {
  const { step, setStep, draft, setDraft, industry, setIndustry, ai, thinking, runAnalysis, answers, setAnswers, buildCard, card, setCard, confirmed, setConfirmed, publish, live, resetBuilder } = p
  const t = useT()
  const steps = [t('step1'), t('step2'), t('step3')]
  const answered = ai ? ai.data.questions.filter((q) => (answers[q.field] || '').trim()).length : 0

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead eyebrow={t('bEyebrow')} title={t('bTitle')} sub={t('bSub')} />

      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => {
          const n = i + 1
          const state = step > n ? 'done' : step === n ? 'active' : 'todo'
          return (
            <li key={s} className="flex flex-1 items-center gap-2">
              <button disabled={n > step} onClick={() => setStep(n)}
                className={cx('flex min-w-0 items-center gap-2 text-xs font-medium transition', state === 'todo' ? 'text-stone-400' : state === 'active' ? 'text-stone-900' : 'text-stone-500 hover:text-stone-900')}>
                <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border text-[11px] tabular-nums',
                  state === 'done' ? 'border-orange-300 bg-orange-100 text-orange-600' : state === 'active' ? 'border-orange-500 text-orange-600' : 'border-stone-300')}>
                  {state === 'done' ? <Check className="size-3.5" /> : n}
                </span>
                <span className="truncate">{s}</span>
              </button>
              {n < steps.length && <span className={cx('h-px flex-1', step > n ? 'bg-orange-300' : 'bg-stone-100')} />}
            </li>
          )
        })}
      </ol>

      {/* Мобильная полоска рейтинга */}
      <div className="sticky top-[61px] z-20 -mx-4 mb-5 border-y border-stone-200 bg-[#F6F4F1]/90 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 xl:hidden">
        <div className="flex items-center gap-3">
          <Gauge className="size-4 text-orange-600" />
          <span className="text-xs text-stone-500">Рейтинг</span>
          <span className="tabular-nums text-sm font-semibold text-stone-900" style={FONT_MONO}>{live.total}<span className="text-stone-500">/100</span></span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-orange-500 transition-all duration-700" style={{ width: `${live.total}%` }} />
          </div>
          <LevelChip score={live.total} />
        </div>
      </div>

      {step === 1 && (
        <div className="q-in space-y-4">
          <Panel className="p-4 sm:p-5">
            <Field label="Что происходит и что хочется изменить" hint={<span className="tabular-nums text-stone-400">{words(draft)} слов</span>}>
              <textarea id="draft" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5}
                placeholder="Например: хотим, чтобы клиенты записывались к нам сами, без звонков"
                className={cx(inputCls, 'resize-none text-[15px] leading-relaxed')} />
            </Field>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <label htmlFor="industry" className="text-xs text-stone-500">Отрасль</label>
                <select id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-orange-400">
                  {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                </select>
              </div>
              <Button variant="primary" size="lg" onClick={runAnalysis} disabled={thinking || !draft.trim()} className="w-full sm:w-auto">
                {thinking ? <><LoaderCircle className="size-4 animate-spin" /> {t('reading')}</> : <><Sparkles className="size-4" /> {t('goAssistant')}</>}
              </Button>
            </div>
          </Panel>

          {thinking ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="q-shimmer h-14 rounded-xl" />)}</div>
          ) : (
            <div>
              <div className="mb-2 text-xs text-stone-500">Не знаете, с чего начать? Возьмите пример</div>
              <div className="flex flex-wrap gap-2">
                {SEED_DRAFTS.map((d) => (
                  <button key={d.text} onClick={() => { setDraft(d.text); setIndustry(d.industry) }}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-left text-xs text-stone-500 transition hover:border-orange-300 hover:text-stone-900">
                    {d.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && ai && (
        <div className="q-in space-y-5">
          {/* Сообщение пользователя — черновик */}
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-3xl rounded-br-md bg-stone-900 px-4 py-3 text-[15px] leading-relaxed text-stone-50 shadow-sm">
              {draft}
            </div>
          </div>

          {/* Помощник */}
          <AssistantBubble>
            <p>Спасибо, понятно, с чего начинать! Чтобы студенты сразу разобрались в задаче, мне не хватает <b className="font-semibold text-orange-600">{ai.data.missing.length} из 7</b> деталей. Ответьте своими словами — я ничего не буду придумывать за вас.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CRITERIA.map((c) => {
                const ok = ai.data.detected[c.key === 'context' ? 'need' : c.key]
                return (
                  <span key={c.key} className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]', ok ? 'bg-emerald-50 text-emerald-700' : 'border border-dashed border-stone-300 text-stone-500')}>
                    {ok ? <Check className="size-3" /> : <CircleAlert className="size-3" />}{c.label}
                  </span>
                )
              })}
            </div>
            {!ai.valid && <p className="mt-3 text-xs text-amber-800">Ответ модели не прошёл проверку — задаю стандартные вопросы.</p>}
          </AssistantBubble>

          {ai.data.questions.map((q, i) => {
            const crit = CRITERIA.find((c) => c.key === (q.field === 'need' ? 'context' : q.field))
            const val = answers[q.field] || ''
            const filled = val.trim().length > 0
            return (
              <div key={q.field} className="q-in space-y-2.5" style={{ animationDelay: `${i * 80}ms` }}>
                <AssistantBubble compact>
                  <p className="text-[15px] text-stone-900">{q.text}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-500">
                    <crit.icon className="size-3.5" />{crit.label}
                    <span className={cx('ml-1 rounded-full px-2 py-0.5 font-semibold tabular-nums', filled ? 'bg-orange-100 text-orange-700' : 'bg-stone-100 text-stone-500')}>до +{crit.weight}</span>
                  </div>
                </AssistantBubble>
                <div className="flex justify-end">
                  <div className="w-full max-w-[85%]">
                    <textarea id={`answer-${q.field}`} rows={2} value={val} onChange={(e) => setAnswers((a) => ({ ...a, [q.field]: e.target.value }))}
                      placeholder="Напишите ответ…"
                      className={cx('w-full resize-none rounded-3xl rounded-br-md border px-4 py-3 text-[15px] leading-relaxed outline-none transition placeholder:text-stone-400 focus:ring-4 focus:ring-orange-500/15',
                        filled ? 'border-stone-900 bg-stone-900 text-stone-50' : 'border-stone-300 border-dashed bg-white text-stone-900 focus:border-orange-400')} />
                    {filled && <div className="mt-1 text-right text-[11px] text-emerald-700"><Check className="mr-1 inline size-3" />Учтено в рейтинге</div>}
                  </div>
                </div>
              </div>
            )
          })}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="quiet" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> Изменить черновик</Button>
            <Button variant="primary" size="lg" onClick={buildCard}>
              <WandSparkles className="size-4" /> {t('buildCard')} <span className="text-white/60">· {answered}/{ai.data.questions.length}</span>
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="q-in space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50/70 px-4 py-3 text-sm text-stone-600">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-orange-600" />
            Карточка собрана только из ваших слов — помощник ничего не добавил от себя. Проверьте и допишите то, что упущено.
          </div>

          <Panel className="p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Название">
                <input id="card-title" value={card.title} onChange={(e) => setCard({ ...card, title: e.target.value })} className={cx(inputCls, 'text-base font-medium')} />
              </Field>
              <Field label="Отрасль">
                <select id="card-industry" value={card.industry} onChange={(e) => setCard({ ...card, industry: e.target.value })} className={inputCls}>
                  {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {CARD_FIELDS.map((f) => {
                const part = live.parts.find((x) => x.key === f.crit)
                const full = part.points >= part.weight
                const wide = ['context', 'need', 'data', 'result', 'criteria'].includes(f.key)
                return (
                  <div key={f.key} className={wide ? 'sm:col-span-2' : ''}>
                    <Field label={f.label} hint={
                      <span className={cx('rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', full ? 'bg-orange-100 text-orange-600' : 'bg-stone-100 text-stone-500')} style={FONT_MONO}>
                        {part.label.split(' ')[0]} {part.points}/{part.weight}
                      </span>
                    }>
                      <textarea id={`card-${f.key}`} rows={wide ? 3 : 2} value={card[f.key]} placeholder={f.ph}
                        onChange={(e) => setCard({ ...card, [f.key]: e.target.value })}
                        className={cx(inputCls, 'resize-y', !card[f.key].trim() && 'border-dashed')} />
                    </Field>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel className="p-4 sm:p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input id="confirm" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-orange-500" />
              <span className="text-sm text-stone-600">Я проверил карточку. Все сведения указаны мной, публикую задачу в общий каталог.</span>
            </label>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button variant="quiet" onClick={() => setStep(2)}><ArrowLeft className="size-4" /> К вопросам</Button>
                <Button variant="quiet" onClick={resetBuilder}><RotateCcw className="size-4" /> Заново</Button>
              </div>
              <Button variant="primary" size="lg" onClick={publish} disabled={!confirmed}>
                <Rocket className="size-4" /> {t('publish')} · {live.total} {t('points')}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────  ПАНЕЛЬ РЕЙТИНГА  ──────────────────────────── */

function RatingPanel({ live, history, step }) {
  const t = useT()
  const gaps = live.parts.filter((p) => p.tip).sort((a, b) => (b.weight - b.points) - (a.weight - a.points))
  const first = history[0]?.score
  return (
    <>
      <Panel glow className="hidden p-5 xl:block">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">{t('score')}</span>
          {first !== undefined && live.total > first && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-600 tabular-nums"><TrendingUp className="size-3.5" />+{live.total - first}</span>
          )}
        </div>
        <div className="mt-4 flex justify-center"><ScoreRing score={live.total} /></div>
        <LevelLadder score={live.total} />
      </Panel>

      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-900">{t('breakdown')}</span>
          <span className="text-xs tabular-nums text-stone-500" style={FONT_MONO}>{live.total}/100</span>
        </div>
        <ul className="space-y-3">
          {live.parts.map((p) => (
            <li key={p.key}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-stone-600"><p.icon className="size-3.5 text-stone-500" />{p.label}</span>
                <span className={cx('tabular-nums', p.points >= p.weight ? 'text-orange-600' : 'text-stone-500')} style={FONT_MONO}>{p.points}/{p.weight}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div className={cx('h-full rounded-full transition-all duration-700', p.points >= p.weight ? 'bg-orange-500' : 'bg-orange-300')} style={{ width: `${(p.points / p.weight) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {gaps.length > 0 && step > 1 && (
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-900"><Sparkles className="size-4 text-orange-600" />{t('raise')}</div>
          <ul className="space-y-2">
            {gaps.slice(0, 4).map((g) => (
              <li key={g.key} className="flex items-start justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-xs text-stone-500">{g.label}</div>
                  <div className="text-sm text-stone-700">{g.tip}</div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-orange-600" style={FONT_MONO}>+{g.weight - g.points}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {history.length > 0 && <GrowthCard history={[...history.slice(0, step === 3 ? 2 : 1), { label: 'Сейчас', score: live.total }]} />}
    </>
  )
}

function LevelLadder({ score }) {
  return (
    <div className="mt-5 grid grid-cols-4 gap-1.5">
      {[...LEVELS].reverse().map((l, i, arr) => {
        const max = i < arr.length - 1 ? arr[i + 1].min - 1 : 100
        const active = levelOf(score).key === l.key
        return (
          <div key={l.key} className={cx('rounded-lg border px-2 py-2 text-center transition', active ? l.chip : 'border-stone-200 text-stone-400')}>
            <div className="text-[10px] font-medium leading-tight">{l.label}</div>
            <div className="mt-0.5 text-[10px] tabular-nums opacity-70" style={FONT_MONO}>{l.min}–{max}</div>
          </div>
        )
      })}
    </div>
  )
}

function GrowthCard({ history }) {
  const t = useT()
  const w = 280, h = 72, pad = 8
  const pts = history.map((p, i) => [pad + (i * (w - pad * 2)) / Math.max(1, history.length - 1), h - pad - (p.score / 100) * (h - pad * 2)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
  const delta = history[history.length - 1].score - history[0].score
  return (
    <Panel className="p-5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">{t('growth')}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl text-orange-600 tabular-nums" style={{ ...FONT_DISPLAY, fontWeight: 600 }}>+{delta}</span>
            <span className="text-xs text-stone-500">{t('fromDraft')}</span>
          </div>
        </div>
        <TrendingUp className="size-5 text-orange-600" />
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" style={{ maxWidth: '100%' }}>
        {[40, 70, 90].map((t) => <line key={t} x1={pad} x2={w - pad} y1={h - pad - (t / 100) * (h - pad * 2)} y2={h - pad - (t / 100) * (h - pad * 2)} stroke="#ece8e4" strokeDasharray="2 4" />)}
        <path d={`${d} L${pts[pts.length - 1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`} fill="rgba(249,115,22,.10)" />
        <path d={d} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2.5} fill={i === pts.length - 1 ? '#ea580c' : '#ffffff'} stroke="#f97316" strokeWidth="1.5" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-stone-500">
        {history.map((p, i) => <span key={i} className="tabular-nums">{p.label} · {p.score}</span>)}
      </div>
    </Panel>
  )
}

/* ────────────────────────────  КАТАЛОГ  ──────────────────────────── */

function Catalog({ tasks, proposals, role, team, onOpen }) {
  const tr = useT()
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState('Все')
  const [lvl, setLvl] = useState('all')

  const recs = role === 'student' && team
    ? tasks.filter((t) => t.score >= 40).map((t) => ({ t, match: t.tags.filter((x) => team.skills.includes(x)).length + (team.interests.includes(t.industry) ? 1 : 0) }))
        .filter((r) => r.match > 0).sort((a, b) => b.match - a.match || b.t.score - a.t.score).slice(0, 3)
    : []

  const list = tasks.filter((t) => (topic === 'Все' || t.industry === topic) && (lvl === 'all' || levelOf(t.score).key === lvl)
    && (!q || (t.title + t.company + t.context).toLowerCase().includes(q.toLowerCase())))

  return (
    <div className="mx-auto max-w-4xl">
      <PageHead eyebrow={tr('cEyebrow')} title={tr('cTitle')} sub={tr('cSub')} />

      {recs.length > 0 && (
        <div className="mb-6">
          <div className="mb-2.5 flex items-center gap-2 text-sm text-stone-600"><Sparkles className="size-4 text-orange-600" />Помощник советует {team.name} <span className="text-xs text-stone-500">· по вашим навыкам; остальные задачи тоже открыты</span></div>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {recs.map(({ t, match }) => (
              <button key={t.id} onClick={() => onOpen(t.id)} className="w-64 shrink-0 snap-start rounded-3xl border border-orange-200 bg-orange-50/70 p-4 text-left transition hover:border-orange-300 sm:w-auto">
                <div className="flex items-center justify-between text-[11px] text-orange-600"><span>{match} совпадения</span><MiniRing score={t.score} size={32} /></div>
                <div className="mt-2 line-clamp-2 text-sm font-medium text-stone-900">{t.title}</div>
                <div className="mt-1 text-xs text-stone-500">{t.company}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
          <input id="catalog-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по задачам и компаниям" className={cx(inputCls, 'pl-10')} />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {['Все', ...INDUSTRIES].map((t) => (
            <button key={t} onClick={() => setTopic(t)} className={cx('shrink-0 rounded-full border px-3 py-1 text-xs transition', topic === t ? 'border-stone-300 bg-stone-100 text-stone-900' : 'border-stone-200 text-stone-500 hover:text-stone-800')}>{t}</button>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button onClick={() => setLvl('all')} className={cx('shrink-0 rounded-full border px-3 py-1 text-xs transition', lvl === 'all' ? 'border-stone-300 bg-stone-100 text-stone-900' : 'border-stone-200 text-stone-500')}>Любой уровень</button>
          {LEVELS.map((l) => (
            <button key={l.key} onClick={() => setLvl(l.key)} className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition', lvl === l.key ? l.chip : 'border-stone-200 text-stone-500')}>
              <span className={cx('size-1.5 rounded-full', l.dot)} />{l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-stone-500">
        <span className="tabular-nums">{list.length} задач · по рейтингу</span>
      </div>

      <ol className="space-y-3">
        {list.map((t) => {
          const pos = tasks.findIndex((x) => x.id === t.id) + 1
          const l = levelOf(t.score)
          const n = proposals.filter((p) => p.taskId === t.id).length
          return (
            <li key={t.id}>
              <button onClick={() => onOpen(t.id)}
                className={cx('q-in group flex w-full items-start gap-3 rounded-3xl border bg-white p-4 text-left backdrop-blur-xl transition sm:gap-4 sm:p-5',
                  l.key === 'priority' ? 'border-orange-300' : 'border-stone-200 hover:border-stone-300', t.isNew && 'ring-2 ring-orange-400/70')}
                style={l.key === 'priority' ? { boxShadow: ACCENT_GLOW } : undefined}>
                <span className="mt-1 w-6 shrink-0 text-center text-xs tabular-nums text-stone-400" style={FONT_MONO}>#{pos}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelChip score={t.score} />
                    {t.isNew && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Новая</span>}
                    {t.owner && <span className="text-[11px] text-stone-500">ваша задача</span>}
                  </div>
                  <div className="mt-2 text-[15px] font-medium text-stone-900 group-hover:text-orange-700">{t.title}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500"><Building2 className="size-3.5" />{t.company} · {t.industry}</div>
                  {l.key === 'draft' && <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-stone-500"><CircleAlert className="size-3.5" />Требует уточнения — откликаться можно</div>}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {t.tags.map((x) => <span key={x} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">{x}</span>)}
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-stone-500"><Users className="size-3.5" />{n}</span>
                  </div>
                </div>
                <MiniRing score={t.score} />
              </button>
            </li>
          )
        })}
      </ol>
      {!list.length && <div className="rounded-3xl border border-dashed border-stone-200 p-10 text-center text-sm text-stone-500">Под эти фильтры задач нет. Сбросьте тему или уровень.</div>}
    </div>
  )
}

/* ────────────────────────────  КАРТОЧКА ЗАДАЧИ (drawer)  ──────────────────────────── */

function TaskDrawer({ task, role, team, proposals, onClose, onSubmit, onGoInbox }) {
  const s = scoreCard(task)
  const mine = proposals.find((p) => p.taskId === task.id && p.teamId === team?.id)
  const [form, setForm] = useState({ idea: '', plan: '', deadline: '4 недели', link: '' })
  const [err, setErr] = useState({})

  const send = () => {
    const e = {}
    if (words(form.idea) < 5) e.idea = 'Опишите идею хотя бы в 5 словах'
    if (words(form.plan) < 3) e.plan = 'Добавьте план по этапам'
    if (!/^https?:\/\/\S+\.\S+/.test(form.link)) e.link = 'Нужна ссылка вида https://…'
    setErr(e)
    if (!Object.keys(e).length) onSubmit(task.id, form)
  }

  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="q-in relative flex h-full w-full flex-col border-l border-stone-200 bg-white sm:max-w-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-stone-500"><Building2 className="size-3.5" />{task.company} · {task.industry}</div>
          <button onClick={onClose} aria-label="Закрыть" className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900"><X className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <LevelChip score={s.total} />
              <h2 className="mt-2 text-xl text-stone-900" style={{ ...FONT_DISPLAY, fontWeight: 600, letterSpacing: '-0.01em' }}>{task.title}</h2>
            </div>
            <ScoreRing score={s.total} size={84} stroke={7} label={false} />
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1" title="Разбивка рейтинга">
            {s.parts.map((p) => (
              <div key={p.key} className="group relative">
                <div className="h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-orange-500" style={{ width: `${(p.points / p.weight) * 100}%` }} /></div>
                <div className="mt-1 truncate text-[9px] text-stone-400">{p.label.split(' ')[0]}</div>
              </div>
            ))}
          </div>

          <dl className="mt-6 space-y-4">
            {CARD_FIELDS.map((f) => (
              <div key={f.key}>
                <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{f.label}</dt>
                <dd className={cx('mt-1 text-sm leading-relaxed', task[f.key] ? 'text-stone-700' : 'italic text-stone-400')}>{task[f.key] || 'Не указано бизнесом'}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border-t border-stone-200 bg-white px-5 py-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          {role === 'business' ? (
            task.owner
              ? <Button variant="primary" className="w-full" onClick={onGoInbox}><Inbox className="size-4" />Отклики на задачу · {proposals.filter((p) => p.taskId === task.id).length}</Button>
              : <p className="text-center text-xs text-stone-500">Переключитесь на «Студенты», чтобы откликнуться</p>
          ) : mine ? (
            <div className="flex items-center gap-2 text-sm text-stone-600"><CircleCheck className="size-4 text-orange-600" />{team.name} уже откликнулась · <StatusChip status={mine.status} /></div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium text-stone-900">Отклик от {team.name}</div>
              <FormInput id="p-idea" label="Идея решения" err={err.idea} area value={form.idea} onChange={(v) => setForm({ ...form, idea: v })} ph="Как вы решите задачу?" />
              <FormInput id="p-plan" label="План" err={err.plan} area value={form.plan} onChange={(v) => setForm({ ...form, plan: v })} ph="Неделя 1 — …; неделя 2 — …" />
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <FormInput id="p-deadline" label="Срок" value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} />
                <FormInput id="p-link" label="Ссылка на прототип" err={err.link} value={form.link} onChange={(v) => setForm({ ...form, link: v })} ph="https://github.com/…" />
              </div>
              <Button variant="primary" size="lg" className="w-full" onClick={send}><Send className="size-4" />Отправить предложение</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FormInput({ id, label, value, onChange, ph, area, err }) {
  const El = area ? 'textarea' : 'input'
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-stone-500">{label}</label>
      <El id={id} value={value} rows={area ? 2 : undefined} placeholder={ph} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, 'resize-none py-2', err && 'border-rose-300')} />
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
    </div>
  )
}

function StatusChip({ status }) {
  const m = {
    pending: ['На рассмотрении', 'text-stone-600 bg-stone-100 border-stone-300'],
    accepted: ['Выбрана', 'text-emerald-700 bg-emerald-50 border-emerald-200'],
    rejected: ['Отклонена', 'text-rose-700 bg-rose-50 border-rose-200'],
  }[status]
  return <span className={cx('rounded-full border px-2 py-0.5 text-[11px] font-medium', m[1])}>{m[0]}</span>
}

/* ────────────────────────────  ОТКЛИКИ (бизнес)  ──────────────────────────── */

function Proposals({ tasks, proposals, teams, milestones, onDecide, onMilestone, newTaskId }) {
  const tr = useT()
  const [tab, setTab] = useState(newTaskId || tasks[0]?.id)
  const task = tasks.find((t) => t.id === tab) || tasks[0]
  const list = proposals.filter((p) => p.taskId === task?.id)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHead eyebrow={tr('pEyebrow')} title={tr('pTitle')} sub={tr('pSub')} />

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {tasks.map((t) => {
          const n = proposals.filter((p) => p.taskId === t.id && p.status === 'pending').length
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={cx('flex max-w-[260px] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition',
              task?.id === t.id ? 'border-stone-300 bg-stone-100 text-stone-900' : 'border-stone-200 text-stone-500 hover:text-stone-900')}>
              <MiniRing score={t.score} size={28} />
              <span className="truncate">{t.title}</span>
              {!!n && <span className="rounded-full bg-orange-100 px-1.5 text-[10px] font-semibold text-orange-600">{n}</span>}
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-stone-200 bg-white/70 px-4 py-3 text-xs text-stone-500">
        <ShieldCheck className="size-4 shrink-0 text-orange-600" />Помощник не выбирает команду за вас — решение всегда остаётся за человеком.
      </div>

      {!list.length ? (
        <div className="rounded-3xl border border-dashed border-stone-200 p-10 text-center">
          <Clock className="mx-auto size-6 text-stone-400" />
          <p className="mt-3 text-sm text-stone-500">Пока нет откликов. Переключитесь на «Студенты» и откликнитесь от любой команды.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((p) => {
            const t = teams.find((x) => x.id === p.teamId)
            return (
              <Panel key={p.id} className={cx('q-in flex flex-col p-4 sm:p-5', p.status === 'accepted' && 'border-emerald-200', p.status === 'rejected' && 'opacity-60')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar team={t} />
                    <div>
                      <div className="text-sm font-medium text-stone-900">{t.name}</div>
                      <div className="text-xs text-stone-500">{t.captain}, капитан · {t.members} в команде</div>
                    </div>
                  </div>
                  <StatusChip status={p.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1">{t.skills.map((x) => <span key={x} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">{x}</span>)}</div>
                <p className="mt-3 text-[15px] leading-relaxed text-stone-800">«{p.idea}»</p>
                <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2.5 text-xs leading-relaxed text-stone-500">{p.plan}</div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{p.deadline}</span>
                  <a href={p.link} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-stone-500 hover:text-orange-600"><Link2 className="size-3.5 shrink-0" /><span className="truncate">{p.link.replace(/^https?:\/\//, '')}</span><ExternalLink className="size-3 shrink-0" /></a>
                </div>
                <div className="mt-auto pt-4">
                  {p.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="danger" onClick={() => onDecide(p.id, 'rejected')}><X className="size-4" />Отклонить</Button>
                      <Button variant="primary" onClick={() => onDecide(p.id, 'accepted')}><Check className="size-4" />Выбрать</Button>
                    </div>
                  )}
                  {p.status === 'accepted' && (milestones[p.id]
                    ? <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700"><Trophy className="size-4" />Этап подтверждён · команда получила +50 баллов</div>
                    : <Button variant="success" className="w-full" onClick={() => onMilestone(p)}><Flag className="size-4" />Подтвердить этап → +50 баллов команде</Button>)}
                  {p.status === 'rejected' && <Button variant="quiet" size="sm" onClick={() => onDecide(p.id, 'pending')}><RotateCcw className="size-3.5" />Вернуть на рассмотрение</Button>}
                </div>
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────  МОИ ОТКЛИКИ (студенты)  ──────────────────────────── */

function MyProposals({ proposals, tasks, milestones, onOpen }) {
  const tr = useT()
  return (
    <div className="mx-auto max-w-3xl">
      <PageHead eyebrow={tr('mEyebrow')} title={tr('mTitle')} sub={tr('mSub')} />
      {!proposals.length ? (
        <div className="rounded-3xl border border-dashed border-stone-200 p-10 text-center text-sm text-stone-500">Откликов пока нет — выберите задачу в каталоге.</div>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => {
            const t = tasks.find((x) => x.id === p.taskId)
            return (
              <li key={p.id}>
                <button onClick={() => onOpen(t.id)} className="flex w-full items-center gap-4 rounded-3xl border border-stone-200 bg-white p-4 text-left transition hover:border-stone-300">
                  <MiniRing score={t.score} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-stone-900">{t.title}</div>
                    <div className="mt-0.5 text-xs text-stone-500">{t.company} · {p.deadline}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusChip status={p.status} />
                    {milestones[p.id] && <span className="text-[11px] font-semibold text-orange-600">+50 баллов</span>}
                  </div>
                  <ChevronRight className="size-4 text-stone-400" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ────────────────────────────  WOW-ПАНЕЛИ  ──────────────────────────── */

function ImpactPanel({ tasks, proposals, teams, role, teamId, history }) {
  const avg = Math.round(tasks.reduce((s, t) => s + t.score, 0) / tasks.length)
  const ready = tasks.filter((t) => t.score >= 70).length
  const dist = [...LEVELS].reverse().map((l, i, arr) => ({ ...l, n: tasks.filter((t) => t.score >= l.min && t.score < (arr[i + 1]?.min ?? 101)).length }))
  const board = [...teams].sort((a, b) => b.points - a.points)
  return (
    <>
      <div className="grid grid-cols-3 gap-2 xl:mt-0">
        {[
          { v: tasks.length, l: 'задач' },
          { v: avg, l: 'ср. рейтинг', accent: true },
          { v: proposals.length, l: 'откликов' },
        ].map((s) => (
          <Panel key={s.l} className="px-3 py-3.5 text-center" glow={s.accent}>
            <div className={cx('text-2xl tabular-nums', s.accent ? 'text-orange-600' : 'text-stone-900')} style={{ ...FONT_DISPLAY, fontWeight: 600 }}>{s.v}</div>
            <div className="mt-0.5 text-[11px] text-stone-500">{s.l}</div>
          </Panel>
        ))}
      </div>

      {history.length > 1 && <GrowthCard history={history} />}

      <Panel className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-900">Готовность каталога</span>
          <span className="text-xs text-stone-500 tabular-nums">{ready} из {tasks.length} готовы</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-stone-100">
          {dist.map((d) => d.n > 0 && <div key={d.key} className={d.bar} style={{ width: `${(d.n / tasks.length) * 100}%` }} />)}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {dist.map((d) => (
            <li key={d.key} className="flex items-center gap-2 text-xs text-stone-500"><span className={cx('size-2 rounded-full', d.dot)} />{d.label}<span className="ml-auto tabular-nums text-stone-500">{d.n}</span></li>
          ))}
        </ul>
      </Panel>

      {role === 'student' && (
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-900"><Trophy className="size-4 text-orange-600" />Баллы команд за прогресс</div>
          <ol className="space-y-2">
            {board.map((t, i) => (
              <li key={t.id} className={cx('flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm', t.id === teamId && 'bg-orange-50')}>
                <span className="w-4 text-xs tabular-nums text-stone-400">{i + 1}</span>
                <Avatar team={t} size="sm" />
                <span className={cx('flex-1', t.id === teamId ? 'font-medium text-stone-900' : 'text-stone-600')}>{t.name}</span>
                <span className="tabular-nums text-stone-600" style={FONT_MONO}>{t.points}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </>
  )
}

function ScenarioTracker({ done, current }) {
  const t = useT()
  const count = done.filter(Boolean).length
  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-900">{t('flow')}</span>
        <span className="text-xs tabular-nums text-stone-500" style={FONT_MONO}>{count}/8</span>
      </div>
      <ol className="relative space-y-3">
        <span className="absolute bottom-2 left-[9px] top-2 w-px bg-stone-100" />
        {SCENARIO.map((_, i) => t(`s${i}`)).map((s, i) => (
          <li key={i} className="relative flex items-center gap-3 text-sm">
            <span className={cx('relative grid size-[19px] shrink-0 place-items-center rounded-full border text-[10px]',
              done[i] ? 'border-orange-500 bg-orange-500 text-white' : i === current ? 'border-orange-500 bg-white text-orange-600' : 'border-stone-300 bg-white text-stone-400')}
              style={i === current ? { boxShadow: '0 0 0 4px rgba(249,115,22,.15)' } : undefined}>
              {done[i] ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cx(done[i] ? 'text-stone-600' : i === current ? 'text-stone-900' : 'text-stone-400')}>{s}</span>
            {i === current && <span className="ml-auto text-[10px] uppercase tracking-wider text-orange-600">{t('now')}</span>}
          </li>
        ))}
      </ol>
    </Panel>
  )
}

/* ────────────────────────────  AI: ПОД КАПОТОМ  ──────────────────────────── */

function AIModal({ ai, draft, onClose }) {
  const sampleDraft = draft || SEED_DRAFTS[0].text
  const out = ai ? JSON.parse(ai.raw) : analyzeDraft(sampleDraft)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="q-in relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-stone-200 bg-white p-5 sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-orange-600"><Braces className="size-3.5" />Под капотом</div>
            <h2 className="mt-1 text-lg text-stone-900" style={{ ...FONT_DISPLAY, fontWeight: 600 }}>Как работает AI-помощник</h2>
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"><X className="size-4" /></button>
        </div>
        <div className="mt-5 space-y-4">
          <Block title="Промпт">{AI_PROMPT}</Block>
          <Block title="Вход">{JSON.stringify({ draft: sampleDraft }, null, 2)}</Block>
          <Block title="Выход">{JSON.stringify(out, null, 2)}</Block>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { i: ShieldCheck, t: 'Без выдуманных фактов', d: 'Карточка собирается только из текста пользователя' },
              { i: CircleAlert, t: 'Невалидный ответ', d: 'JSON без 3+ вопросов → шаблонные вопросы' },
              { i: Info, t: 'Решает человек', d: 'Публикация и выбор команды — только вручную' },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-stone-200 p-3">
                <x.i className="size-4 text-orange-600" />
                <div className="mt-2 text-xs font-medium text-stone-900">{x.t}</div>
                <div className="mt-0.5 text-[11px] text-stone-500">{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Block({ title, children }) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-stone-500">{title}</div>
      <pre className="max-h-56 overflow-auto rounded-xl border border-stone-200 bg-white p-3 text-[12px] leading-relaxed text-stone-600 whitespace-pre-wrap" style={FONT_MONO}>{children}</pre>
    </div>
  )
}

function Toast({ tone, text }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8">
      <div className={cx('q-in flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-2xl backdrop-blur-xl',
        tone === 'ok' ? 'border-orange-200 bg-white text-stone-900' : tone === 'warn' ? 'border-amber-200 bg-white text-amber-800' : 'border-stone-300 bg-white text-stone-700')}>
        {tone === 'ok' ? <CircleCheck className="size-4 text-orange-600" /> : tone === 'warn' ? <CircleAlert className="size-4" /> : <Info className="size-4" />}
        {text}
      </div>
    </div>
  )
}
