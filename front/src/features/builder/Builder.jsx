import { useState } from 'react'
import { Check, Sparkles, LoaderCircle, ArrowLeft, WandSparkles, ShieldCheck, Rocket, RotateCcw, CircleAlert, Gauge } from 'lucide-react'
import { VoiceInput } from './VoiceInput.jsx'
import { PageHead } from '../../components/shell/PageHead.jsx'
import { AssistantBubble } from '../../components/shell/AssistantBubble.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { Panel } from '../../components/ui/Panel.jsx'
import { Field } from '../../components/ui/Field.jsx'
import { LevelChip } from '../../components/ui/LevelChip.jsx'
import { inputCls } from '../../components/ui/inputCls.js'
import { cx } from '../../lib/cx.js'
import { QUESTION_BANK } from '../../lib/ai.js'
import { createVoiceCoordinator } from '../../lib/voice.js'
import { words, FONT_MONO, CRITERIA, CARD_FIELDS } from '../../lib/scoring.js'
import { INDUSTRIES, SEED_DRAFTS, industryKey } from '../../data/seed.js'
import { useT } from '../../i18n/LangContext.jsx'

export function Builder(p) {
  const { step, setStep, draft, setDraft, industry, setIndustry, ai, thinking, aiMessage, runAnalysis, answers, setAnswers, buildCard, card, setCard, confirmed, setConfirmed, publish, live, resetBuilder } = p
  const t = useT()
  const [voiceCoordinator] = useState(createVoiceCoordinator)
  const [activeVoiceTarget, setActiveVoiceTarget] = useState(null)
  const voiceBusy = activeVoiceTarget !== null
  const setVoiceBusy = (target, busy) => {
    setActiveVoiceTarget((current) => busy ? target : current === target ? null : current)
  }
  const steps = [t('step1'), t('step2'), t('step3')]
  const answered = ai ? ai.data.questions.filter((q) => (answers[q.field] || '').trim()).length : 0
  const updateCard = (field, value) => { setCard({ ...card, [field]: value }); setConfirmed(false) }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead eyebrow={t('bEyebrow')} title={t('bTitle')} sub={t('bSub')} />

      <ol className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => {
          const n = i + 1
          const state = step > n ? 'done' : step === n ? 'active' : 'todo'
          return (
            <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
              <button type="button" disabled={voiceBusy || (n > step && !(n === 2 && ai))} onClick={() => setStep(n)}
                className={cx('flex min-w-0 items-center gap-2 text-xs font-medium transition', state === 'todo' ? 'text-stone-400' : state === 'active' ? 'text-stone-900' : 'text-stone-500 hover:text-stone-900')}>
                <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border text-[11px] tabular-nums',
                  state === 'done' ? 'border-orange-300 bg-orange-100 text-orange-600' : state === 'active' ? 'border-orange-500 text-orange-600' : 'border-stone-300')}>
                  {state === 'done' ? <Check className="size-3.5" /> : n}
                </span>
                <span className="truncate">{s}</span>
              </button>
              {n < steps.length && <span className={cx('h-px flex-1', step > n ? 'bg-orange-300' : 'bg-stone-100')} />}
            </li>
          )
        })}
      </ol>

      <div className="sticky top-[61px] z-20 -mx-4 mb-5 border-y border-stone-200 bg-canvas/90 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 xl:hidden">
        <div className="flex items-center gap-3">
          <Gauge className="size-4 text-orange-600" />
          <span className="text-xs text-stone-500">{t('ratingShort')}</span>
          <span className="tabular-nums text-sm font-semibold text-stone-900" style={FONT_MONO}>{live.total}<span className="text-stone-500">/100</span></span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-orange-500 transition-all duration-700" style={{ width: `${live.total}%` }} />
          </div>
          <LevelChip score={live.total} />
        </div>
      </div>

      {step === 1 && (
        <div className="q-in space-y-4">
          <Panel className="p-4 sm:p-5">
            <Field label={t('draftLabel')} hint={<span className="tabular-nums text-stone-400">{words(draft)} {t('wordsCount')}</span>}>
              <textarea id="draft" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5}
                placeholder={t('draftPh')}
                className={cx(inputCls, 'resize-none text-[15px] leading-relaxed')} />
            </Field>
            <VoiceInput key="draft" value={draft} onChange={setDraft} targetId="draft" coordinator={voiceCoordinator}
              disabled={thinking || (voiceBusy && activeVoiceTarget !== 'draft')}
              onBusyChange={(busy) => setVoiceBusy('draft', busy)} />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <label htmlFor="industry" className="text-xs text-stone-500">{t('industry')}</label>
                <select id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="rounded-lg border border-stone-200 bg-surface px-2.5 py-1.5 text-xs text-stone-700 outline-none focus:border-orange-400">
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{t(industryKey(i))}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {ai && <Button variant="quiet" onClick={() => setStep(2)} disabled={thinking || voiceBusy}>{t('backToQuestions')}</Button>}
                <Button variant="primary" size="lg" onClick={runAnalysis} disabled={thinking || voiceBusy || !draft.trim()} className="w-full sm:w-auto">
                  {thinking ? <><LoaderCircle className="size-4 animate-spin" /> {t('reading')}</> : <><Sparkles className="size-4" /> {t('goAssistant')}</>}
                </Button>
              </div>
            </div>
          </Panel>

          {aiMessage && <AssistantReply message={aiMessage} />}

          {thinking ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="q-shimmer h-14 rounded-xl" />)}</div>
          ) : (
            <div>
              <div className="mb-2 text-xs text-stone-500">{t('examplesHint')}</div>
              <div className="flex flex-wrap gap-2">
                {SEED_DRAFTS.map((d) => (
                  <button key={d.text} type="button" disabled={voiceBusy} onClick={() => { setDraft(d.text); setIndustry(d.industry) }}
                    className="rounded-full border border-stone-200 bg-surface px-3 py-1.5 text-left text-xs text-stone-500 transition hover:border-orange-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50">
                    {d.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && ai && (
        <div className="q-in space-y-5">
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-3xl rounded-br-md bg-bubble px-4 py-3 text-[15px] leading-relaxed text-on-bubble shadow-sm">
              {draft}
            </div>
          </div>

          <AssistantBubble>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-orange-700">{t(ai.source === 'ai' ? 'aiSourceAI' : 'aiSourceStub')}</p>
            <AssistantIntro n={ai.data.missing.length} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CRITERIA.map((c) => {
                const ok = ai.data.detected[c.key === 'context' ? 'need' : c.key]
                return (
                  <span key={c.key} className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]', ok ? 'bg-emerald-50 text-emerald-700' : 'border border-dashed border-stone-300 text-stone-500')}>
                    {ok ? <Check className="size-3" /> : <CircleAlert className="size-3" />}{t(`crit_${c.key}`)}
                  </span>
                )
              })}
            </div>
            {ai.source === 'stub' && <p className="mt-3 text-xs text-amber-800" role="status">{t('aiFallback')}</p>}
          </AssistantBubble>

          <p id="answers-voice-hint" className="text-xs leading-relaxed text-stone-500">{t('voiceHint')}</p>

          {ai.data.questions.map((q, i) => {
            const crit = CRITERIA.find((c) => c.key === (q.field === 'need' ? 'context' : q.field))
            const val = answers[q.field] || ''
            const filled = val.trim().length > 0
            return (
              <div key={q.field} className="q-in space-y-2.5" style={{ animationDelay: `${i * 80}ms` }}>
                <AssistantBubble compact>
                  <p id={`question-${q.field}`} className="text-[15px] text-stone-900">{ai.source === 'ai' ? q.text : t(`ask_${q.field}${ai.data.detected[q.field] && QUESTION_BANK[q.field]?.refine ? '_refine' : ''}`)}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-500">
                    <crit.icon className="size-3.5" />{t(`crit_${crit.key}`)}
                    <span className={cx('ml-1 rounded-full px-2 py-0.5 font-semibold tabular-nums', filled ? 'bg-orange-100 text-orange-700' : 'bg-stone-100 text-stone-500')}>{t('upTo')}{crit.weight}</span>
                  </div>
                </AssistantBubble>
                <div className="flex justify-end">
                  <div className="w-full max-w-[85%]">
                    <textarea id={`answer-${q.field}`} rows={2} value={val} onChange={(e) => setAnswers((a) => ({ ...a, [q.field]: e.target.value }))}
                      aria-labelledby={`question-${q.field}`}
                      placeholder={t('answerPh')}
                      className={cx('w-full resize-none rounded-3xl rounded-br-md border px-4 py-3 text-[15px] leading-relaxed outline-none transition placeholder:text-stone-400 focus:ring-4 focus:ring-orange-500/15',
                        filled ? 'border-bubble bg-bubble text-on-bubble' : 'border-stone-300 border-dashed bg-surface text-stone-900 focus:border-orange-400')} />
                    {filled && <div className="mt-1 text-right text-[11px] text-emerald-700"><Check className="mr-1 inline size-3" />{t('countedInScore')}</div>}
                    <VoiceInput key={`answer-${q.field}`} value={val} targetId={`answer-${q.field}`} label={t(`field_${q.field}`)}
                      startLabel={t('voiceAnswer')} descriptionId="answers-voice-hint" coordinator={voiceCoordinator}
                      onChange={(value) => setAnswers((current) => ({ ...current, [q.field]: value }))}
                      disabled={thinking || (voiceBusy && activeVoiceTarget !== `answer-${q.field}`)}
                      onBusyChange={(busy) => setVoiceBusy(`answer-${q.field}`, busy)} />
                  </div>
                </div>
              </div>
            )
          })}

          {aiMessage && <AssistantReply message={aiMessage} />}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="quiet" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> {t('editDraft')}</Button>
            <Button variant="primary" size="lg" onClick={buildCard} disabled={thinking || voiceBusy}>
              {thinking ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles className="size-4" />} {thinking ? t('buildingCard') : t('buildCard')} <span className="text-on-accent/60">· {answered}/{ai.data.questions.length}</span>
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="q-in space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50/70 px-4 py-3 text-sm text-stone-600">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-orange-600" />
            {t('cardBanner')}
          </div>

          {ai?.card && <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">{t(ai.card.source === 'ai' ? 'aiSourceAI' : 'aiSourceStub')}</p>}

          {ai?.card?.source === 'stub' && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t('cardFallback')}</div>}
          {!!ai?.card?.warnings?.length && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">{t('cardWarnings')}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">{ai.card.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
            </div>
          )}

          <Panel className="p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label={t('titleLabel')}>
                <input id="card-title" value={card.title} onChange={(e) => updateCard('title', e.target.value)} className={cx(inputCls, 'text-base font-medium')} />
              </Field>
              <Field label={t('industry')}>
                <select id="card-industry" value={card.industry} onChange={(e) => updateCard('industry', e.target.value)} className={inputCls}>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{t(industryKey(i))}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {CARD_FIELDS.map((f) => {
                const part = live.parts.find((x) => x.key === f.crit)
                const full = part.points >= part.weight
                const wide = ['context', 'need', 'data', 'result', 'criteria'].includes(f.key)
                const critLabel = t(`crit_${f.crit}`)
                return (
                  <div key={f.key} className={wide ? 'sm:col-span-2' : ''}>
                    <Field label={t(`field_${f.key}`)} hint={
                      <span className={cx('rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', full ? 'bg-orange-100 text-orange-600' : 'bg-stone-100 text-stone-500')} style={FONT_MONO}>
                        {critLabel.split(' ')[0]} {part.points}/{part.weight}
                      </span>
                    }>
                      <textarea id={`card-${f.key}`} rows={wide ? 3 : 2} value={card[f.key]} placeholder={t(`field_${f.key}_ph`)}
                        onChange={(e) => updateCard(f.key, e.target.value)}
                        className={cx(inputCls, 'resize-y', !card[f.key].trim() && 'border-dashed')} />
                    </Field>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel className="p-4 sm:p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input id="confirm" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-orange-500" />
              <span className="text-sm text-stone-600">{t('confirmCard')}</span>
            </label>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button variant="quiet" onClick={() => setStep(2)}><ArrowLeft className="size-4" /> {t('backToQuestions')}</Button>
                <Button variant="quiet" onClick={resetBuilder}><RotateCcw className="size-4" /> {t('startOver')}</Button>
              </div>
              <Button variant="primary" size="lg" onClick={publish} disabled={!confirmed}>
                <Rocket className="size-4" /> {t('publish')} · {live.total} {t('points')}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

function AssistantReply({ message }) {
  return (
    <div role="status" aria-live="polite">
      <AssistantBubble><p className="text-[15px] leading-relaxed text-stone-900">{message}</p></AssistantBubble>
    </div>
  )
}

function AssistantIntro({ n }) {
  const t = useT()
  const parts = t('assistantIntro', { n: '___' }).split('___')
  return (
    <p>{parts[0]}<b className="font-semibold text-orange-600">{n}</b>{parts[1]}</p>
  )
}
