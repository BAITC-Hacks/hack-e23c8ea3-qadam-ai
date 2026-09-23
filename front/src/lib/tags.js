// JS \b is not a Cyrillic word boundary. Match full Unicode words instead.
const BOT = /(?:^|[^\p{L}\p{M}\p{N}_])(?:(?:чат)?бот(?:а|у|ом|е|ы|ов|ам|ами|ах)?|(?:chat)?bots?)(?=$|[^\p{L}\p{M}\p{N}_])/iu
const TELEGRAM = /(?:^|[^\p{L}\p{M}\p{N}_])(?:telegram|телеграм(?:а|у|ом|е)?)(?=$|[^\p{L}\p{M}\p{N}_])/iu
const TECHNOLOGY_FIELDS = ['title', 'context', 'need', 'users', 'data', 'constraints', 'result', 'criteria']

/** Heuristic tags for new publications, not a migration of existing task tags. */
export function inferTaskTags(card) {
  const text = Object.values(card).join(' ')
  // A consultation channel in contact/format is not a required task technology.
  const technologyText = TECHNOLOGY_FIELDS.map((field) => card[field] || '').join(' ')
  return [
    ...(TELEGRAM.test(technologyText) ? ['Telegram'] : []),
    ...(BOT.test(technologyText) ? ['Бот'] : []),
    // Keep the existing Web/Analytics rules and publication fallback unchanged.
    ...(/сайт|веб|web|форм|заявк/i.test(text) ? ['Web', 'React'] : []),
    ...(/данн|аналит|excel|1с|отчёт/i.test(text) ? ['Аналитика'] : []),
  ]
}
