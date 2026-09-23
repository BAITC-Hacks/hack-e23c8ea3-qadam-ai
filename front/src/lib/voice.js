const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
const MAX_BYTES = 5 * 1024 * 1024
const MAX_SECONDS = 60
const REQUEST_TIMEOUT_MS = 30_000
const ERROR_KEYS = {
  voice_unavailable: 'voiceUnavailable', unsupported_audio: 'voiceUnsupported',
  audio_too_large: 'voiceTooLarge', empty_audio: 'voiceEmpty', invalid_audio: 'voiceFailed',
  no_speech: 'voiceNoSpeech', transcription_timeout: 'voiceTimeout', transcription_failed: 'voiceFailed',
}

export function appendTranscript(draft, text) {
  const previous = typeof draft === 'string' ? draft : ''
  const next = typeof text === 'string' ? text.trim() : ''
  if (!next) return previous
  return previous ? `${previous}${previous.endsWith('\n') ? '' : '\n'}${next}` : next
}

/** Share one recording/transcription slot across multiple voice inputs. */
export function createVoiceCoordinator() {
  let currentOwner = null
  return {
    acquire(owner) {
      if (currentOwner !== null && currentOwner !== owner) return false
      currentOwner = owner
      return true
    },
    release(owner) {
      if (currentOwner === owner) currentOwner = null
    },
  }
}

function stopTracks(stream) {
  for (const track of stream?.getTracks() || []) {
    try { track.stop() } catch { /* Continue releasing the other tracks. */ }
  }
}

/** No microphone access until start(); dependencies are injectable for lifecycle tests. */
export function createVoiceSession(options = {}) {
  const onState = options.onState || (() => {})
  const onTranscript = options.onTranscript || (() => {})
  const later = options.setTimeout || globalThis.setTimeout
  const clearLater = options.clearTimeout || globalThis.clearTimeout
  const every = options.setInterval || globalThis.setInterval
  const clearEvery = options.clearInterval || globalThis.clearInterval
  const now = options.now || Date.now
  let active = null, disposed = false
  let state = { phase: 'idle', elapsed: 0, error: null }

  const isCurrent = (job) => !disposed && active === job
  const emit = (phase, elapsed = state.elapsed, error = null) => {
    if (disposed) return
    state = { phase, elapsed, error }
    onState({ ...state })
  }

  function clearCapture(job) {
    clearEvery(job.ticker)
    clearLater(job.limit)
    job.ticker = job.limit = null
    if (job.recorder) {
      job.recorder.ondataavailable = job.recorder.onstop = job.recorder.onerror = null
      try { if (job.recorder.state !== 'inactive') job.recorder.stop() } catch { /* Already stopped. */ }
      job.recorder = null
    }
    stopTracks(job.stream)
    job.stream = null
  }

  function release(job) {
    clearCapture(job)
    clearLater(job.deadline)
    job.controller?.abort()
    job.controller = null
    job.chunks = []
    options.coordinator?.release(job)
  }

  function fail(job, error) {
    if (!isCurrent(job)) return
    release(job)
    emit('error', state.elapsed, error)
    if (active === job) active = null
  }

  async function transcribe(job) {
    if (!isCurrent(job)) return
    const audio = new Blob(job.chunks, { type: job.mime.split(';')[0].toLowerCase() })
    job.chunks = []
    clearCapture(job)
    if (!audio.size) { fail(job, 'voiceEmpty'); return }
    const Controller = options.AbortController || globalThis.AbortController
    const send = options.fetch || globalThis.fetch
    if (!Controller || !send) { fail(job, 'voiceUnavailable'); return }
    job.controller = new Controller()
    job.deadline = later(() => fail(job, 'voiceTimeout'), REQUEST_TIMEOUT_MS)
    emit('transcribing')
    if (!isCurrent(job)) return
    try {
      const response = await send('/api/voice/transcribe', {
        method: 'POST', headers: { 'Content-Type': audio.type }, body: audio,
        signal: job.controller.signal,
      })
      if (!isCurrent(job)) return
      let body
      try { body = await response.json() } catch { fail(job, 'voiceFailed'); return }
      if (!isCurrent(job)) return
      if (!response.ok) {
        const code = body?.code || body?.error
        const mapped = Object.hasOwn(ERROR_KEYS, code) ? ERROR_KEYS[code] : null
        const statusKey = response.status === 413 ? 'voiceTooLarge'
          : response.status === 415 ? 'voiceUnsupported'
            : [401, 403, 503].includes(response.status) ? 'voiceUnavailable'
              : [408, 504].includes(response.status) ? 'voiceTimeout' : 'voiceFailed'
        fail(job, mapped || statusKey)
        return
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).length !== 1 || typeof body.text !== 'string') {
        fail(job, 'voiceFailed')
        return
      }
      const text = body.text.trim()
      if (!text) { fail(job, 'voiceNoSpeech'); return }
      release(job)
      emit('done')
      if (isCurrent(job)) onTranscript(text)
      if (active === job) active = null
    } catch {
      if (isCurrent(job)) fail(job, 'voiceUnavailable')
    }
  }

  function stop() {
    const job = active
    if (!job || state.phase !== 'recording' || job.stopping) return
    job.stopping = true
    clearEvery(job.ticker)
    clearLater(job.limit)
    try { job.recorder.stop() } catch { fail(job, 'voiceMicError') }
  }

  async function start() {
    if (disposed || (active && ['requesting', 'recording', 'transcribing'].includes(state.phase))) return
    const job = { chunks: [], size: 0, stream: null, recorder: null, stopping: false }
    if (options.coordinator && !options.coordinator.acquire(job)) return
    active = job
    emit('requesting', 0)
    if (!isCurrent(job)) return
    const Recorder = options.MediaRecorder || globalThis.MediaRecorder
    const media = globalThis.navigator?.mediaDevices
    const acquire = options.getUserMedia || media?.getUserMedia?.bind(media)
    let mime
    try { mime = MIME_TYPES.find((type) => Recorder?.isTypeSupported?.(type)) } catch { /* Unsupported API. */ }
    if (!Recorder || !acquire || !mime) { fail(job, 'voiceUnsupported'); return }
    try {
      const stream = await acquire({ audio: true })
      if (!isCurrent(job)) { stopTracks(stream); return }
      job.stream = stream
      job.recorder = new Recorder(stream, { mimeType: mime })
      job.mime = job.recorder.mimeType || mime
      if (!['audio/webm', 'audio/mp4', 'audio/wav', 'audio/mpeg'].includes(job.mime.split(';')[0].toLowerCase())) {
        fail(job, 'voiceUnsupported')
        return
      }
      job.recorder.ondataavailable = ({ data }) => {
        if (!isCurrent(job) || !data?.size) return
        job.size += data.size
        if (job.size > MAX_BYTES) { fail(job, 'voiceTooLarge'); return }
        job.chunks.push(data)
      }
      job.recorder.onerror = () => fail(job, 'voiceMicError')
      job.recorder.onstop = () => { void transcribe(job) }
      job.recorder.start(1000)
      if (!isCurrent(job)) return
      const began = now()
      job.ticker = every(() => {
        if (isCurrent(job)) emit('recording', Math.min(MAX_SECONDS, Math.floor((now() - began) / 1000)))
      }, 1000)
      job.limit = later(() => {
        if (!isCurrent(job)) return
        emit('recording', MAX_SECONDS)
        stop()
      }, MAX_SECONDS * 1000)
      emit('recording', 0)
    } catch (error) {
      const key = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error?.name) ? 'voicePermission'
        : ['NotFoundError', 'DevicesNotFoundError'].includes(error?.name) ? 'voiceNoMic' : 'voiceMicError'
      fail(job, key)
    }
  }

  function cancel() {
    const previous = active
    active = null
    if (previous) release(previous)
    emit('idle', 0)
  }

  function dispose() {
    disposed = true
    cancel()
  }

  return { start, stop, cancel, dispose }
}
