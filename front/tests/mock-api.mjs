// Test-only API fixture for exercising the Vite proxy and constructor in a browser.
import { createServer } from 'node:http'
import { analyzeDraft, buildLocalTaskCard } from '../src/lib/ai.js'

const mode = process.env.MOCK_AI_MODE || 'ai'
const port = Number(process.env.MOCK_AI_PORT || 8000)

createServer(async (request, response) => {
  if (request.method !== 'POST' || !['/api/constructor/analyze', '/api/constructor/card'].includes(request.url)) {
    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Not Found' }))
    return
  }

  if (mode === 'timeout') return
  if (mode === '503') {
    response.writeHead(503, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Mock service unavailable' }))
    return
  }
  if (mode === 'invalid') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end('{broken')
    return
  }
  if (mode === '422') {
    response.writeHead(422, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Проверьте черновик задачи' }))
    return
  }

  try {
    let raw = ''
    for await (const chunk of request) raw += chunk
    const input = JSON.parse(raw)
    const output = request.url.endsWith('/analyze')
      ? { ...analyzeDraft(input.draft), source: 'ai' }
      : { ...buildLocalTaskCard(input), warnings: ['Тестовое предупреждение: проверьте карточку'], source: 'ai' }
    if (request.url.endsWith('/analyze')) output.questions = output.questions.map((q) => ({ ...q, text: `МОК: ${q.text}` }))
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(output))
  } catch {
    response.writeHead(400, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Invalid mock request' }))
  }
}).listen(port, 'localhost', () => {
  process.stdout.write(`Mock constructor API: http://localhost:${port} (${mode})\n`)
})
