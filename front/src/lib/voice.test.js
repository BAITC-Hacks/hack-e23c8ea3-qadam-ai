import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendTranscript, createVoiceSession } from './voice.js'

const flush = () => new Promise((resolve) => setImmediate(resolve))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function harness(overrides = {}) {
  let time = 0, nextTimer = 0
  const timers = new Map(), states = [], transcripts = [], requests = [], recorders = []
  const track = { stopped: 0, stop() { this.stopped++ } }
  const stream = { getTracks: () => [track] }
  const schedule = (fn, ms, repeat = false) => {
    const id = ++nextTimer
    timers.set(id, { fn, at: time + ms, ms, repeat })
    return id
  }
  class Recorder {
    static isTypeSupported = (type) => type === 'audio/webm;codecs=opus'
    constructor(value, options) {
      this.stream = value
      this.mimeType = options.mimeType
      this.state = 'inactive'
      this.finalChunk = new Blob(['final'])
      recorders.push(this)
    }
    start(timeslice) { this.timeslice = timeslice; this.state = 'recording' }
    data(blob) { this.ondataavailable?.({ data: blob }) }
    stop() {
      this.state = 'inactive'
      queueMicrotask(() => { this.data(this.finalChunk); this.onstop?.() })
    }
  }
  const options = {
    onState: (state) => states.push(state), onTranscript: (text) => transcripts.push(text),
    getUserMedia: async (constraints) => { assert.deepEqual(constraints, { audio: true }); return stream },
    MediaRecorder: Recorder,
    fetch: async (url, init) => { requests.push({ url, ...init }); return { ok: true, json: async () => ({ text: '  spoken words  ' }) } },
    now: () => time,
    setTimeout: (fn, ms) => schedule(fn, ms), clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, ms) => schedule(fn, ms, true), clearInterval: (id) => timers.delete(id),
    ...overrides,
  }
  const session = createVoiceSession(options)
  return {
    session, track, stream, states, transcripts, requests, recorders, timers, options,
    tick(ms) {
      const target = time + ms
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        const [id, timer] = next
        time = timer.at
        if (timer.repeat) timer.at += timer.ms
        else timers.delete(id)
        timer.fn()
      }
      time = target
    },
  }
}

test('append transcript preserves existing text and handles empty values', () => {
  assert.equal(appendTranscript('  existing draft  ', ' new text '), '  existing draft  \nnew text')
  assert.equal(appendTranscript('existing\n', 'new'), 'existing\nnew')
  assert.equal(appendTranscript('', ' new '), 'new')
  assert.equal(appendTranscript('draft', '   '), 'draft')
  assert.equal(appendTranscript('', ''), '')
})

test('records only on start, includes final chunk, releases mic, posts raw audio', async () => {
  const h = harness()
  assert.equal(h.recorders.length, 0)
  await h.session.start()
  const recorder = h.recorders[0]
  assert.equal(recorder.timeslice, 1000)
  recorder.data(new Blob(['first']))
  h.tick(2000)
  assert.equal(h.states.at(-1).elapsed, 2)
  h.session.stop()
  h.session.stop()
  await flush()
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0].url, '/api/voice/transcribe')
  assert.equal(h.requests[0].method, 'POST')
  assert.equal(h.requests[0].headers['Content-Type'], 'audio/webm')
  assert.equal(await h.requests[0].body.text(), 'firstfinal')
  assert.equal(h.track.stopped, 1)
  assert.deepEqual(h.transcripts, ['spoken words'])
  assert.deepEqual(h.states.at(-1), { phase: 'done', elapsed: 2, error: null })
  assert.equal(h.timers.size, 0)
})

test('permission and device failures are safe keys and can be retried', async () => {
  for (const [name, error] of [['NotAllowedError', 'voicePermission'], ['SecurityError', 'voicePermission'], ['NotFoundError', 'voiceNoMic'], ['NotReadableError', 'voiceMicError']]) {
    const h = harness({ getUserMedia: async () => { throw Object.assign(new Error('private details'), { name }) } })
    await h.session.start()
    assert.deepEqual(h.states.at(-1), { phase: 'error', elapsed: 0, error })
    assert.equal(h.requests.length, 0)
    assert.equal(h.timers.size, 0)
  }
})

test('cancel while permission is pending stops late stream and ignores stale callbacks', async () => {
  const permission = deferred()
  const h = harness({ getUserMedia: () => permission.promise })
  const start = h.session.start()
  h.session.cancel()
  const count = h.states.length
  permission.resolve(h.stream)
  await start
  assert.equal(h.track.stopped, 1)
  assert.equal(h.recorders.length, 0)
  assert.equal(h.states.length, count)
  assert.equal(h.states.at(-1).phase, 'idle')
})

test('cancel during recording drops final chunk and never sends audio', async () => {
  const h = harness()
  await h.session.start()
  h.session.cancel()
  await flush()
  assert.equal(h.track.stopped, 1)
  assert.equal(h.requests.length, 0)
  assert.equal(h.transcripts.length, 0)
  assert.equal(h.timers.size, 0)
})

test('cancel aborts transcription and ignores a late successful response', async () => {
  const response = deferred()
  let signal
  const h = harness({ fetch: (_url, init) => { signal = init.signal; return response.promise } })
  await h.session.start()
  h.session.stop()
  await flush()
  assert.equal(h.states.at(-1).phase, 'transcribing')
  h.session.cancel()
  assert.equal(signal.aborted, true)
  response.resolve({ ok: true, json: async () => ({ text: 'stale' }) })
  await flush()
  assert.deepEqual(h.transcripts, [])
  assert.equal(h.states.at(-1).phase, 'idle')
})

test('dispose suppresses callbacks and all later starts', async () => {
  const h = harness()
  await h.session.start()
  const count = h.states.length
  h.session.dispose()
  await h.session.start()
  h.session.cancel()
  await flush()
  assert.equal(h.states.length, count)
  assert.equal(h.recorders.length, 1)
  assert.equal(h.track.stopped, 1)
  assert.equal(h.timers.size, 0)
})

test('60 second limit automatically stops and transcribes once', async () => {
  const h = harness()
  await h.session.start()
  h.tick(60000)
  await flush()
  assert.equal(h.requests.length, 1)
  assert.equal(h.states.at(-1).elapsed, 60)
  assert.equal(h.track.stopped, 1)
  assert.equal(h.timers.size, 0)
})

test('oversized data immediately stops mic and never uploads', async () => {
  const h = harness()
  await h.session.start()
  h.recorders[0].data(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]))
  await flush()
  assert.equal(h.states.at(-1).error, 'voiceTooLarge')
  assert.equal(h.track.stopped, 1)
  assert.equal(h.requests.length, 0)
  assert.equal(h.timers.size, 0)
})

test('empty audio is rejected without a request', async () => {
  const h = harness()
  await h.session.start()
  h.recorders[0].finalChunk = new Blob([])
  h.session.stop()
  await flush()
  assert.equal(h.states.at(-1).error, 'voiceEmpty')
  assert.equal(h.requests.length, 0)
  assert.equal(h.track.stopped, 1)
})

test('timeout aborts even when fetch ignores its signal', async () => {
  let signal
  const h = harness({ fetch: (_url, init) => { signal = init.signal; return new Promise(() => {}) } })
  await h.session.start()
  h.session.stop()
  await flush()
  h.tick(30000)
  assert.equal(signal.aborted, true)
  assert.equal(h.states.at(-1).error, 'voiceTimeout')
  assert.equal(h.timers.size, 0)
})

test('server error codes map to safe i18n keys, never raw messages', async () => {
  const cases = { voice_unavailable: 'voiceUnavailable', unsupported_audio: 'voiceUnsupported', audio_too_large: 'voiceTooLarge', empty_audio: 'voiceEmpty', invalid_audio: 'voiceFailed', no_speech: 'voiceNoSpeech', transcription_timeout: 'voiceTimeout', transcription_failed: 'voiceFailed', private_message: 'voiceFailed' }
  for (const [code, error] of Object.entries(cases)) {
    const h = harness({ fetch: async () => ({ ok: false, status: 400, json: async () => ({ error: code, detail: 'private details' }) }) })
    await h.session.start()
    h.session.stop()
    await flush()
    assert.equal(h.states.at(-1).error, error)
    assert.equal(h.track.stopped, 1)
  }
})

test('malformed and empty transcripts never get appended', async () => {
  for (const [body, error] of [[{}, 'voiceFailed'], [{ text: 5 }, 'voiceFailed'], [{ text: ' ' }, 'voiceNoSpeech'], [{ text: 'a', extra: true }, 'voiceFailed']]) {
    const h = harness({ fetch: async () => ({ ok: true, json: async () => body }) })
    await h.session.start()
    h.session.stop()
    await flush()
    assert.equal(h.states.at(-1).error, error)
    assert.deepEqual(h.transcripts, [])
  }
})

test('rapid duplicate starts do not create extra microphone sessions', async () => {
  const permission = deferred()
  let calls = 0
  const h = harness({ getUserMedia: () => { calls++; return permission.promise } })
  const first = h.session.start()
  await h.session.start()
  permission.resolve(h.stream)
  await first
  await h.session.start()
  assert.equal(calls, 1)
  h.session.cancel()
})

test('only supported MIME candidates are selected; unsupported browsers never request mic', async () => {
  const h = harness()
  h.options.MediaRecorder.isTypeSupported = (type) => type === 'audio/mp4'
  await h.session.start()
  assert.equal(h.recorders[0].mimeType, 'audio/mp4')
  h.session.stop()
  await flush()
  assert.equal(h.requests[0].headers['Content-Type'], 'audio/mp4')
  let requested = false
  const bad = harness({ getUserMedia: async () => { requested = true } })
  bad.options.MediaRecorder.isTypeSupported = (type) => type === 'audio/ogg'
  await bad.session.start()
  assert.equal(bad.states.at(-1).error, 'voiceUnsupported')
  assert.equal(bad.recorders.length, 0)
  assert.equal(requested, false)
})

test('restart is not replaced by a previous permission result', async () => {
  const firstPermission = deferred(), secondPermission = deferred()
  let calls = 0, oldStops = 0
  const oldStream = { getTracks: () => [{ stop: () => oldStops++ }] }
  const h = harness({ getUserMedia: () => (++calls === 1 ? firstPermission.promise : secondPermission.promise) })
  const first = h.session.start()
  h.session.cancel()
  const second = h.session.start()
  secondPermission.resolve(h.stream)
  await second
  const count = h.states.length
  firstPermission.resolve(oldStream)
  await first
  assert.equal(oldStops, 1)
  assert.equal(h.track.stopped, 0)
  assert.equal(h.states.length, count)
  assert.equal(h.states.at(-1).phase, 'recording')
  h.session.cancel()
})

test('restart completes while an old aborted response is ignored', async () => {
  const oldResponse = deferred()
  let requests = 0
  const h = harness({ fetch: async () => ++requests === 1 ? oldResponse.promise : { ok: true, json: async () => ({ text: 'new recording' }) } })
  await h.session.start()
  h.session.stop()
  await flush()
  h.session.cancel()
  await h.session.start()
  h.session.stop()
  await flush()
  oldResponse.resolve({ ok: true, json: async () => ({ text: 'old recording' }) })
  await flush()
  assert.deepEqual(h.transcripts, ['new recording'])
  assert.equal(h.states.at(-1).phase, 'done')
  assert.equal(h.timers.size, 0)
})

test('recorder construction and runtime errors release the microphone', async () => {
  class BrokenRecorder {
    static isTypeSupported = () => true
    constructor() { throw new Error('Could not construct recorder') }
  }
  const broken = harness({ MediaRecorder: BrokenRecorder })
  await broken.session.start()
  assert.equal(broken.states.at(-1).error, 'voiceMicError')
  assert.equal(broken.track.stopped, 1)
  const h = harness()
  await h.session.start()
  h.recorders[0].onerror({ error: new Error('private details') })
  await flush()
  assert.equal(h.states.at(-1).error, 'voiceMicError')
  assert.equal(h.track.stopped, 1)
  assert.equal(h.requests.length, 0)
  assert.equal(h.timers.size, 0)
})

test('final chunk is included in the total size limit', async () => {
  const h = harness()
  await h.session.start()
  h.recorders[0].data(new Blob([new Uint8Array(5 * 1024 * 1024)]))
  h.session.stop()
  await flush()
  assert.equal(h.states.at(-1).error, 'voiceTooLarge')
  assert.equal(h.requests.length, 0)
  assert.equal(h.track.stopped, 1)
})

test('deadline covers a stalled response body as well as connection', async () => {
  const body = deferred()
  const h = harness({ fetch: async () => ({ ok: true, json: () => body.promise }) })
  await h.session.start()
  h.session.stop()
  await flush()
  h.tick(30000)
  assert.equal(h.states.at(-1).error, 'voiceTimeout')
  body.resolve({ text: 'too late' })
  await flush()
  assert.deepEqual(h.transcripts, [])
})

test('network and non-JSON failures show safe errors', async () => {
  for (const [send, error] of [
    [async () => { throw new Error('private host') }, 'voiceUnavailable'],
    [async () => ({ ok: true, json: async () => { throw new Error('private body') } }), 'voiceFailed'],
  ]) {
    const h = harness({ fetch: send })
    await h.session.start()
    h.session.stop()
    await flush()
    assert.equal(h.states.at(-1).error, error)
    assert.deepEqual(h.transcripts, [])
    assert.equal(h.timers.size, 0)
  }
})
