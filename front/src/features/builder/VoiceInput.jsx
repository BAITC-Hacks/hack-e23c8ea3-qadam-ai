import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check, CircleAlert, LoaderCircle, Mic, Square, X } from 'lucide-react'
import { Button } from '../../components/ui/Button.jsx'
import { useT } from '../../i18n/LangContext.jsx'
import { appendTranscript, createVoiceSession } from '../../lib/voice.js'

const BUSY_PHASES = new Set(['requesting', 'recording', 'transcribing'])
const INITIAL_STATE = { phase: 'idle', elapsed: 0, error: null }

export function VoiceInput({ draft, onChange, disabled, onBusyChange }) {
  const t = useT()
  const hintId = useId()
  const [state, setState] = useState(INITIAL_STATE)
  const session = useRef(null)
  const latest = useRef({ draft, onChange, onBusyChange })
  useLayoutEffect(() => {
    latest.current = { draft, onChange, onBusyChange }
  }, [draft, onChange, onBusyChange])

  useEffect(() => {
    const current = createVoiceSession({
      onState: (next) => {
        setState(next)
        latest.current.onBusyChange(BUSY_PHASES.has(next.phase))
      },
      onTranscript: (text) => {
        const { draft: currentDraft, onChange: change } = latest.current
        change(appendTranscript(currentDraft, text))
      },
    })
    session.current = current
    const cancelOnHide = () => {
      if (document.visibilityState === 'hidden') current.cancel()
    }
    const cancelOnLeave = () => current.cancel()
    document.addEventListener('visibilitychange', cancelOnHide)
    window.addEventListener('pagehide', cancelOnLeave)
    return () => {
      current.dispose()
      session.current = null
      document.removeEventListener('visibilitychange', cancelOnHide)
      window.removeEventListener('pagehide', cancelOnLeave)
      latest.current.onBusyChange(false)
    }
  }, [])

  const busy = BUSY_PHASES.has(state.phase)
  const recording = state.phase === 'recording'
  const waiting = state.phase === 'requesting' || state.phase === 'transcribing'
  const statusKey = {
    requesting: 'voiceRequesting', recording: 'voiceRecording',
    transcribing: 'voiceTranscribing', done: 'voiceDone',
  }[state.phase]
  const elapsed = `${Math.floor(state.elapsed / 60)}:${String(state.elapsed % 60).padStart(2, '0')}`

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!busy && (
          <Button size="sm" disabled={disabled} onClick={() => session.current?.start()}
            aria-controls="draft" aria-describedby={hintId} className="min-h-10 disabled:opacity-50">
            <Mic aria-hidden="true" className="size-4 shrink-0 text-orange-600" />
            {t('voiceStart')}
          </Button>
        )}
        {recording && (
          <Button size="sm" onClick={() => session.current?.stop()} aria-controls="draft"
            className="h-auto min-h-10 border-orange-300 bg-orange-50 py-2 text-orange-700">
            <Square aria-hidden="true" className="size-3.5 shrink-0 fill-current" />
            {t('voiceStop')}
          </Button>
        )}
        {waiting && <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-orange-600" />}
        {busy && (
          <Button size="sm" variant="quiet" onClick={() => session.current?.cancel()} className="min-h-10">
            <X aria-hidden="true" className="size-3.5 shrink-0" />{t('voiceCancel')}
          </Button>
        )}
        {!busy && <span className="text-[11px] text-stone-400">Whisper</span>}
      </div>
      <p id={hintId} className="text-[11px] leading-relaxed text-stone-500">{t('voiceHint')}</p>
      <div role="status" aria-live="polite" aria-atomic="true">
        {statusKey && (
          <p className="flex items-center gap-2 text-xs text-stone-600">
            {recording && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-rose-500 motion-safe:animate-pulse" />}
            {state.phase === 'done' && <Check aria-hidden="true" className="size-3.5 shrink-0 text-emerald-700" />}
            {t(statusKey)}
          </p>
        )}
      </div>
      {recording && <p aria-hidden="true" className="text-xs tabular-nums text-stone-500">{elapsed} / 1:00</p>}
      {state.error && (
        <p role="alert" className="flex items-start gap-2 text-xs leading-relaxed text-rose-700">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{t(state.error)}
        </p>
      )}
    </div>
  )
}
