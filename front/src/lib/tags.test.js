import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inferTaskTags } from './tags.js'
import { recommendTasks } from './catalog.js'
import { scoreCard } from './scoring.js'
import { EMPTY_CARD, SEED_TEAMS } from '../data/seed.js'

const tagsFor = (result) => inferTaskTags({ ...EMPTY_CARD, result })
const botTags = (tags) => tags.filter((tag) => tag === 'Telegram' || tag === 'Бот')

test('QA-03: work and development words do not imply bots or Telegram', () => {
  for (const text of ['План работы', 'Срок разработки четыре недели', 'Обработка продаж', 'Ботаника', 'ботинки', 'robot', 'robotics', 'bottom', 'бот_архив', 'mytelegramservice']) {
    assert.deepEqual(botTags(tagsFor(text)), [], text)
  }
})

test('generic bots and common inflections get only the bot tag', () => {
  for (const text of ['Бот', 'бота', 'боту', 'ботом', 'боте', 'боты', 'ботов', 'ботам', 'ботами', 'ботах', 'чатбот', 'чат-бот', 'bot', 'BOTS', 'chatbot', 'chatbots']) {
    assert.deepEqual(botTags(tagsFor(text)), ['Бот'], text)
  }
})

test('Telegram integrations do not automatically imply a bot', () => {
  for (const text of ['Интеграция с Telegram', 'Экспорт в телеграм', 'Работа с Телеграмом']) {
    assert.deepEqual(botTags(tagsFor(text)), ['Telegram'], text)
  }
})

test('explicit Telegram bots get both tags once, including punctuation and mixed languages', () => {
  for (const text of ['Telegram-бот', 'Telegram bot', 'телеграм-бота', '(TELEGRAM): chatbot', 'Telegram — бот; Telegram и боты']) {
    assert.deepEqual(botTags(tagsFor(text)), ['Telegram', 'Бот'], text)
  }
})

test('contact and consultation fields do not declare task bot technologies', () => {
  const card = { ...EMPTY_CARD, title: 'Планирование выпечки', contact: 'Связь: Telegram @demo_contact', format: 'Пишите боту в Telegram по вторникам' }
  assert.deepEqual(botTags(inferTaskTags(card)), [])
  assert.deepEqual(botTags(inferTaskTags({ ...card, result: 'Бот для заказов' })), ['Бот'])
})

test('existing Web, React and Analytics detection stays unchanged', () => {
  for (const text of ['сайт', 'веб', 'web', 'форм', 'заявк']) assert.deepEqual(tagsFor(text), ['Web', 'React'])
  for (const text of ['данные', 'аналитика', 'EXCEL', '1С', 'отчёт']) assert.deepEqual(tagsFor(text), ['Аналитика'])
  assert.deepEqual(tagsFor('Сайт с аналитикой Excel'), ['Web', 'React', 'Аналитика'])
  assert.deepEqual(inferTaskTags({ ...EMPTY_CARD, contact: 'данные Excel', format: 'web' }), ['Web', 'React', 'Аналитика'])
  assert.deepEqual(inferTaskTags(EMPTY_CARD), [])
})

test('bakery task with work constraints is not falsely recommended to Qazaq Devs', () => {
  const card = {
    ...EMPTY_CARD,
    title: 'Сократить списания выпечки', industry: 'HoReCa',
    context: 'Каждый вечер пекарня списывает непроданную выпечку, продажи учитываются вручную.',
    need: 'Помочь пекарям точнее планировать количество продукции на следующий день.',
    users: 'Пекари и управляющий нашей пекарни.',
    data: 'Есть данные о продажах и списаниях в Excel за последние шесть месяцев.',
    constraints: 'Срок работы четыре недели. Разработка выполняется локально, без платных сервисов.',
    result: 'Аналитический отчёт о продажах и расчёт количества выпечки на день.',
    criteria: 'Сумма списаний должна снизиться на 20% за месяц пилота.',
    contact: 'Контакт в Telegram: @bakery_demo',
    format: 'Созвон в Telegram по вторникам для обсуждения промежуточных результатов.',
  }
  const task = { ...card, id: 'bakery-qa03', tags: inferTaskTags(card), score: scoreCard(card).total }
  const team = SEED_TEAMS.find((item) => item.name === 'Qazaq Devs')
  assert.ok(task.score >= 40, 'the task must be eligible for recommendations by score')
  assert.deepEqual(task.tags, ['Аналитика'])
  assert.deepEqual(recommendTasks([task], team), [])
  const botTask = { ...task, tags: inferTaskTags({ ...card, result: 'Telegram-бот для приёма заказов' }) }
  assert.equal(recommendTasks([botTask], team)[0].match, 2)
})
