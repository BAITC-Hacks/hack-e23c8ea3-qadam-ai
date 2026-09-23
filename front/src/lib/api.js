const DEFAULT_TIMEOUT_MS = 45_000

export class ApiError extends Error {
  constructor(kind, message, status = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

const cancelledMessage = {
  aborted: 'Запрос отменён',
  timeout: 'Превышено время ожидания ответа ИИ',
}

function httpMessage(status, body) {
  if (status === 422) {
    const detail = body && typeof body.error === 'string' ? body.error.trim() : ''
    return detail || 'Проверьте введённые данные'
  }
  return `Сервис ИИ недоступен (HTTP ${status})`
}

async function postJson(path, payload, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('timeoutMs must be a positive finite number')
  }
  if (signal?.aborted) throw new ApiError('aborted', cancelledMessage.aborted)

  const controller = new AbortController()
  let cancelKind = null
  let rejectCancellation
  const cancellation = new Promise((_, reject) => { rejectCancellation = reject })
  const cancel = (kind) => {
    if (cancelKind) return
    cancelKind = kind
    controller.abort()
    rejectCancellation(new ApiError(kind, cancelledMessage[kind]))
  }
  const onAbort = () => cancel('aborted')
  signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => cancel('timeout'), timeoutMs)

  try {
    const request = async () => {
      let response
      try {
        response = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
      } catch {
        if (cancelKind) throw new ApiError(cancelKind, cancelledMessage[cancelKind])
        throw new ApiError('network', 'Не удалось связаться с сервисом ИИ')
      }

      let body
      try {
        body = await response.json()
      } catch {
        if (cancelKind) throw new ApiError(cancelKind, cancelledMessage[cancelKind])
        if (!response.ok) throw new ApiError('http', httpMessage(response.status), response.status)
        throw new ApiError('invalid-json', 'Сервис ИИ вернул некорректный JSON')
      }
      if (!response.ok) throw new ApiError('http', httpMessage(response.status, body), response.status)
      return body
    }

    return await Promise.race([request(), cancellation])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export function analyzeTask({ draft, industry }, options) {
  return postJson('/api/constructor/analyze', { draft, industry }, options)
}

export function buildTaskCard({ draft, industry, answers }, options) {
  return postJson('/api/constructor/card', { draft, industry, answers }, options)
}
