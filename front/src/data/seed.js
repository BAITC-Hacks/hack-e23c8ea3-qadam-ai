export const INDUSTRIES = ['Ритейл', 'Логистика', 'Услуги', 'Финансы', 'HoReCa', 'Образование']
export const MY_COMPANY = 'Qala Service'

/** Отрасль хранится по-русски (данные), подпись берётся из i18n: t(industryKey(x)). */
export const INDUSTRY_KEYS = { 'Ритейл': 'retail', 'Логистика': 'logistics', 'Услуги': 'services', 'Финансы': 'finance', 'HoReCa': 'horeca', 'Образование': 'education' }
export const industryKey = (value) => (INDUSTRY_KEYS[value] ? `ind_${INDUSTRY_KEYS[value]}` : value)

/** Companies a business user can act as (demo picker). */
export const SEED_COMPANIES = [
  { id: 'c-qala', name: MY_COMPANY, contactName: 'Айжан', roleLabelKey: 'managerRole' },
  { id: 'c-dala', name: 'Dala Logistics', contactName: 'Айгерим', roleLabelKey: 'managerRole' },
  { id: 'c-taza', name: 'Taza Market', contactName: 'Данияр', roleLabelKey: 'managerRole' },
]

export const SEED_DRAFTS = [
  { industry: 'Услуги', text: 'Нужен бот для записи клиентов в наш салон' },
  { industry: 'Ритейл', text: 'Хотим понять, почему клиенты перестают возвращаться' },
  { industry: 'Финансы', text: 'Автоматизировать отчёты по продажам, сейчас всё вручную в Excel' },
  { industry: 'Услуги', text: 'Сделать сайт для приёма заявок на ремонт техники' },
  { industry: 'Логистика', text: 'Товары на складе часто заканчиваются, есть выгрузки из 1С, нужна аналитика' },
]

export const SEED_TASKS = [
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

export const SEED_TEAMS = [
  { id: 'k1', name: 'Byte Nomads', captain: 'Айдана', members: 4, skills: ['React', 'Web', 'Node.js'], interests: ['Услуги', 'Ритейл'], points: 120 },
  { id: 'k2', name: 'Steppe AI', captain: 'Тимур', members: 3, skills: ['Python', 'ML', 'Аналитика'], interests: ['Логистика', 'Финансы'], points: 180 },
  { id: 'k3', name: 'Data Batyrs', captain: 'Ерлан', members: 5, skills: ['SQL', 'Аналитика', 'Дашборд'], interests: ['Ритейл', 'HoReCa'], points: 90 },
  { id: 'k4', name: 'Qazaq Devs', captain: 'Мадина', members: 3, skills: ['Telegram', 'Бот', 'Python'], interests: ['Услуги', 'Образование'], points: 60 },
  { id: 'k5', name: 'Pixel Qanat', captain: 'Алихан', members: 4, skills: ['Web', 'React', 'Figma'], interests: ['HoReCa', 'Услуги'], points: 40 },
]

export const SEED_PROPOSALS = [
  { id: 'p1', taskId: 't3', teamId: 'k1', status: 'pending', idea: 'PWA с формой заявки, выбором услуги из прайса и статусами ремонта для клиента по ссылке.', plan: 'Неделя 1 — форма и прайс; 2–3 — панель мастера; 4 — Telegram-уведомления; 5 — пилот.', deadline: '5 недель', link: 'https://github.com/byte-nomads/qala-repair' },
  { id: 'p2', taskId: 't3', teamId: 'k4', status: 'pending', idea: 'Telegram-бот для заявок: клиент выбирает услугу, бот создаёт карточку в Google Sheets мастера.', plan: 'Неделя 1 — сценарии бота; 2 — интеграция с Sheets; 3 — статусы; 4 — тест с мастерами.', deadline: '4 недели', link: 'https://github.com/qazaq-devs/repair-bot' },
  { id: 'p3', taskId: 't3', teamId: 'k5', status: 'pending', idea: 'Лендинг с формой заявки и калькулятором стоимости ремонта по прайсу.', plan: 'Неделя 1 — дизайн; 2 — вёрстка; 3 — форма и калькулятор; 4 — запуск.', deadline: '4 недели', link: 'https://figma.com/@pixel-qanat/qala' },
  { id: 'p4', taskId: 't1', teamId: 'k2', status: 'pending', idea: 'Модель прогноза спроса на LightGBM и дашборд дефицита по SKU на 14 дней.', plan: 'Неделя 1–2 — EDA и признаки; 3–4 — модель; 5 — дашборд; 6 — пилот.', deadline: '6 недель', link: 'https://github.com/steppe-ai/dala-forecast' },
  { id: 'p5', taskId: 't2', teamId: 'k3', status: 'pending', idea: 'RFM-сегментация и когортный анализ удержания с дашбордом в Metabase.', plan: 'Неделя 1 — очистка чеков; 2 — RFM; 3 — когорты; 4 — дашборд и выводы.', deadline: '4 недели', link: 'https://github.com/data-batyrs/taza-churn' },
]

// Цвет аватара команды — только для узнаваемости, не акцент
export const TEAM_TINT = { k1: 'bg-rose-100 text-rose-700', k2: 'bg-sky-100 text-sky-700', k3: 'bg-amber-100 text-amber-800', k4: 'bg-emerald-100 text-emerald-700', k5: 'bg-violet-100 text-violet-700' }

export const EMPTY_CARD = { title: '', industry: 'Услуги', context: '', need: '', users: '', data: '', constraints: '', result: '', criteria: '', contact: '', format: '' }

export const SCENARIO = ['Черновик', 'Уточнение', 'Карточка', 'Рейтинг', 'Каталог', 'Отклик команды', 'Выбор бизнеса', 'Результат']
