import { analyzeTask, buildTaskCard } from './api.js'
import { analyzeDraft, buildLocalTaskCard, validateAIResponse } from './ai.js'

async function withFallback(request, input, kind, local, options) {
  try {
    const response = await request(input, options)
    const checked = validateAIResponse(response, kind)
    if (checked.ok) return checked.data
  } catch (error) {
    if (error?.kind === 'aborted' || (error?.kind === 'http' && error.status === 422)) throw error
  }
  return local(input)
}

export function analyzeWithFallback(input, options) {
  return withFallback(analyzeTask, input, 'analyze', ({ draft }) => analyzeDraft(draft), options)
}

export function aiStateFromAnalysis(data, input) {
  return { data, source: data.source, raw: JSON.stringify(data), valid: data.source === 'ai', input, card: null }
}

export function cardWithFallback(input, options) {
  return withFallback(buildTaskCard, input, 'card', buildLocalTaskCard, options)
}
