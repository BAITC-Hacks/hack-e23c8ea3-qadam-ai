import { Target, Database, Flag, ListChecks, Lock, Users, Handshake } from 'lucide-react'

export const FONT_DISPLAY = { fontFamily: "'Rubik', 'Onest', system-ui, sans-serif" }
export const FONT_BODY = { fontFamily: "'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif" }
export const FONT_MONO = { fontFamily: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace" }

// Единственный акцент — тёплый оранжевый (orange-500 #f97316 / orange-600 для текста). Только для AI-помощника, рейтинга и главных действий.
export const ACCENT_GLOW = '0 1px 2px rgba(41,37,36,.04), 0 16px 40px -16px rgba(234,88,12,.35)'

// Уровни готовности — семантические цвета, не акцент. label keys resolved via i18n (level_*).
export const LEVELS = [
  { min: 90, key: 'priority', label: 'Приоритетная', text: 'text-orange-600', chip: 'text-orange-700 bg-orange-50 border-orange-300', dot: 'bg-orange-500', bar: 'bg-orange-500', note: 'Полностью готова, выделена в каталоге' },
  { min: 70, key: 'ready', label: 'Готовая', text: 'text-emerald-700', chip: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500', note: 'Повышенная позиция в каталоге' },
  { min: 40, key: 'working', label: 'Рабочая', text: 'text-amber-800', chip: 'text-amber-800 bg-amber-50 border-amber-200', dot: 'bg-amber-400', bar: 'bg-amber-400', note: 'Можно откликаться, AI может рекомендовать' },
  { min: 0, key: 'draft', label: 'Черновик', text: 'text-stone-600', chip: 'text-stone-600 bg-stone-100 border-stone-200', dot: 'bg-stone-400', bar: 'bg-stone-300', note: 'Видна в каталоге, требует уточнения' },
]
export const levelOf = (s) => LEVELS.find((l) => s >= l.min)

export const CRITERIA = [
  { key: 'context', label: 'Контекст и потребность', weight: 20, icon: Target, how: 'Понятно, что происходит сейчас и что нужно изменить' },
  { key: 'data', label: 'Данные и материалы', weight: 20, icon: Database, how: 'Указаны данные, примеры или источники' },
  { key: 'result', label: 'Ожидаемый результат', weight: 15, icon: Flag, how: 'Описан конкретный результат работы команды' },
  { key: 'criteria', label: 'Критерии успеха', weight: 15, icon: ListChecks, how: 'Есть измеримые признаки принятия решения' },
  { key: 'constraints', label: 'Ограничения', weight: 10, icon: Lock, how: 'Сроки, технологии, доступы или иные границы' },
  { key: 'users', label: 'Пользователи', weight: 10, icon: Users, how: 'Понятно, для кого создаётся решение' },
  { key: 'contact', label: 'Связь с бизнесом', weight: 10, icon: Handshake, how: 'Контакт, формат консультаций, обратная связь' },
]

export const CARD_FIELDS = [
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

export const words = (t) => (t || '').trim().split(/\s+/).filter(Boolean).length
export const quality = (t) => { const w = words(t); if (!w) return 0; if (w < 4) return 0.35; if (w < 10) return 0.7; return 1 }
export const hasNumber = (t) => /\d/.test(t || '')
export const hasContact = (t) => /@|\+?\d[\d\s()-]{6,}|t\.me|telegram|whatsapp/i.test(t || '')
export const formatScoreDelta = (delta) => delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '0'

/** Returns i18n tip key (resolved in UI via useT). */
export function tipFor(key, card, q) {
  if (q >= 1) return null
  if (key === 'context') return !card.need?.trim() || quality(card.context) >= 1 ? 'tip_context_need' : 'tip_context_more'
  if (key === 'criteria' && quality(card.criteria) > 0.6 && !hasNumber(card.criteria)) return 'tip_criteria_number'
  if (key === 'contact') {
    if (!hasContact(card.contact)) return 'tip_contact_channel'
    if (quality(card.format) < 1) return 'tip_contact_format'
  }
  const field = CARD_FIELDS.find((f) => f.crit === key)
  return !card[field.key]?.trim() ? `tip_fill_${field.key}` : 'tip_more'
}

// Potential for the stated action only; the other fields retain their current quality.
function qualityAfterTip(key, card, tip) {
  if (key === 'context') return tip === 'tip_context_need'
    ? (quality(card.context) + 1) / 2
    : (1 + quality(card.need)) / 2
  if (key === 'contact') return tip === 'tip_contact_format'
    ? Math.min(quality(card.contact), hasContact(card.contact) ? 1 : 0.5) * 0.6 + 0.4
    : 0.6 + quality(card.format) * 0.4
  if (key === 'criteria') return tip === 'tip_criteria_number'
    ? quality(`${card.criteria} 0`)
    : hasNumber(card.criteria) ? 1 : 0.6
  return 1
}

/** Прозрачная формула: баллы = вес × качество поля (0 / 0.35 / 0.7 / 1). */
export function scoreCard(card) {
  const parts = CRITERIA.map((c) => {
    let q
    if (c.key === 'context') q = (quality(card.context) + quality(card.need)) / 2
    else if (c.key === 'contact') q = Math.min(quality(card.contact), hasContact(card.contact) ? 1 : 0.5) * 0.6 + quality(card.format) * 0.4
    else if (c.key === 'criteria') q = Math.min(quality(card.criteria), hasNumber(card.criteria) ? 1 : 0.6)
    else q = quality(card[c.key])
    const points = Math.round(c.weight * q)
    const tip = tipFor(c.key, card, points >= c.weight ? 1 : q)
    const tipGain = tip ? Math.max(0, Math.round(c.weight * qualityAfterTip(c.key, card, tip)) - points) : 0
    return { ...c, points, tip, tipGain }
  })
  return { total: parts.reduce((s, p) => s + p.points, 0), parts }
}
