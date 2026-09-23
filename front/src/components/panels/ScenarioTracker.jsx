import { Check, ArrowRight } from 'lucide-react'
import { Panel } from '../ui/Panel.jsx'
import { cx } from '../../lib/cx.js'
import { FONT_MONO } from '../../lib/scoring.js'
import { SCENARIO } from '../../data/seed.js'
import { useT } from '../../i18n/LangContext.jsx'

// Шаги 6–8 относятся к последней опубликованной задаче — подсказываем, что сделать и где.
const HINTS = { 5: 'flowHint5', 6: 'flowHint6', 7: 'flowHint7' }
const ACTIONS = { 5: 'flowGo5', 6: 'flowGo6', 7: 'flowGo6' }

export function ScenarioTracker({ done, current, flowTitle, flowAccepted = true, onAction }) {
  const t = useT()
  const count = done.filter(Boolean).length
  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-900">{t('flow')}</span>
        <span className="text-xs tabular-nums text-stone-500" style={FONT_MONO}>{count}/8</span>
      </div>
      {flowTitle && (
        <p className="-mt-2 mb-4 text-xs text-stone-500">{t('flowFor')} <span className="font-medium text-stone-700">«{flowTitle}»</span></p>
      )}
      <ol className="relative space-y-3">
        <span className="absolute bottom-2 left-[9px] top-2 w-px bg-stone-100" />
        {SCENARIO.map((_, i) => t(`s${i}`)).map((s, i) => (
          <li key={i} className="relative text-sm">
            <div className="flex items-center gap-3">
              <span className={cx('relative grid size-[19px] shrink-0 place-items-center rounded-full border text-[10px]',
                done[i] ? 'border-orange-500 bg-orange-500 text-on-accent' : i === current ? 'border-orange-500 bg-surface text-orange-600' : 'border-stone-300 bg-surface text-stone-400')}
                style={i === current ? { boxShadow: '0 0 0 4px rgba(249,115,22,.15)' } : undefined}>
                {done[i] ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cx(done[i] ? 'text-stone-600' : i === current ? 'text-stone-900' : 'text-stone-400')}>{s}</span>
              {i === current && <span className="ml-auto text-[10px] uppercase tracking-wider text-orange-600">{t('now')}</span>}
            </div>
            {i === current && HINTS[i] && flowTitle && (() => {
              // Шаг 8 без выбранной команды: подтверждать нечего — сначала выбрать команду.
              const hint = i === 7 && !flowAccepted ? 'flowHint7None' : HINTS[i]
              return (
              <div className="ml-[31px] mt-1.5 rounded-xl bg-orange-50 px-3 py-2 text-xs leading-relaxed text-stone-600">
                {t(hint, { title: flowTitle })}
                {onAction && (
                  <button type="button" onClick={() => onAction(i)}
                    className="mt-1.5 flex items-center gap-1 font-medium text-orange-600 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70 rounded">
                    {t(ACTIONS[i])} <ArrowRight className="size-3.5" />
                  </button>
                )}
              </div>
              )
            })()}
          </li>
        ))}
      </ol>
    </Panel>
  )
}
