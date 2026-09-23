import { ApiError, analyzeTask, buildTaskCard } from './api.js'
import { validateAIResponse } from './ai.js'

async function requestAI(request, input, kind, options) {
  const response = await request(input, options)
  const checked = validateAIResponse(response, kind)
  if (checked.ok) return checked.data
  throw new ApiError('invalid-response', 'Ответ ИИ не прошёл проверку. Ваш текст сохранён; попробуйте ещё раз.')
}

export function analyzeWithAI(input, options) {
  return requestAI(analyzeTask, input, 'analyze', options)
}

export function aiStateFromAnalysis(data, input) {
  return { data, source: data.source, raw: JSON.stringify(data), valid: data.source === 'ai', input, card: null }
}

export function answersAfterDraftChange(previousDraft, nextDraft, currentAnswers) {
  return previousDraft === nextDraft ? currentAnswers : {}
}

export function cardWithAI(input, options) {
  return requestAI(buildTaskCard, input, 'card', options)
}
