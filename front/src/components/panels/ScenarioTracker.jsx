import { Check } from 'lucide-react'
import { Panel } from '../ui/Panel.jsx'
import { cx } from '../../lib/cx.js'
import { FONT_MONO } from '../../lib/scoring.js'
import { SCENARIO } from '../../data/seed.js'
import { useT } from '../../i18n/LangContext.jsx'

export function ScenarioTracker({ done, current }) {
  const t = useT()
  const count = done.filter(Boolean).length
  return (
    <Panel className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-900">{t('flow')}</span>
        <span className="text-xs tabular-nums text-stone-500" style={FONT_MONO}>{count}/8</span>
      </div>
      <ol className="relative space-y-3">
        <span className="absolute bottom-2 left-[9px] top-2 w-px bg-stone-100" />
        {SCENARIO.map((_, i) => t(`s${i}`)).map((s, i) => (
          <li key={i} className="relative flex items-center gap-3 text-sm">
            <span className={cx('relative grid size-[19px] shrink-0 place-items-center rounded-full border text-[10px]',
              done[i] ? 'border-orange-500 bg-orange-500 text-white' : i === current ? 'border-orange-500 bg-white text-orange-600' : 'border-stone-300 bg-white text-stone-400')}
              style={i === current ? { boxShadow: '0 0 0 4px rgba(249,115,22,.15)' } : undefined}>
              {done[i] ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cx(done[i] ? 'text-stone-600' : i === current ? 'text-stone-900' : 'text-stone-400')}>{s}</span>
            {i === current && <span className="ml-auto text-[10px] uppercase tracking-wider text-orange-600">{t('now')}</span>}
          </li>
        ))}
      </ol>
    </Panel>
  )
}
