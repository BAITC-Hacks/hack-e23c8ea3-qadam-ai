/**
 * Thin client for relative /api calls (Vite proxies to FastAPI).
 * Error body shape: { "error": "..." } — see AGENTS.md / backend main.py.
 *
 * Catalog, teams and proposals are NOT on the server (AI-only backend).
 */

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * @param {string} path - absolute path starting with /api
 * @param {RequestInit & { timeoutMs?: number }} [options]
 */
export async function apiRequest(path, options = {}) {
  const { timeoutMs = 25000, signal, ...init } = options
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  if (signal) {
    if (signal.aborted) ctrl.abort()
    else signal.addEventListener('abort', () => ctrl.abort(), { once: true })
  }

  let res
  try {
    res = await fetch(path, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch (err) {
    clearTimeout(timer)
    if (err?.name === 'AbortError') throw new ApiError('Превышено время ожидания ответа сервера', 408)
    throw new ApiError('Сервер недоступен', 0)
  }
  clearTimeout(timer)

  let body = null
  const text = await res.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!res.ok) {
    const message = body && typeof body.error === 'string' ? body.error : `Ошибка ${res.status}`
    throw new ApiError(message, res.status)
  }

  return body
}

/** @returns {Promise<import('../types.ts').HealthResponse>} */
export function getHealth() {
  return apiRequest('/api/health')
}

/**
 * @param {import('../types.ts').AnalyzeRequest} payload
 * @returns {Promise<import('../types.ts').AnalyzeResponse>}
 */
export function analyzeDraftApi(payload) {
  return apiRequest('/api/constructor/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * @param {import('../types.ts').BuildCardRequest} payload
 * @returns {Promise<import('../types.ts').BuildCardResponse>}
 */
export function buildCardApi(payload) {
  return apiRequest('/api/constructor/card', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
