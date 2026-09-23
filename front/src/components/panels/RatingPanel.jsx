import { TrendingUp, Sparkles } from 'lucide-react'
import { Panel } from '../ui/Panel.jsx'
import { ScoreRing } from '../ui/ScoreRing.jsx'
import { cx } from '../../lib/cx.js'
import { FONT_MONO } from '../../lib/scoring.js'
import { useT } from '../../i18n/LangContext.jsx'
import { GrowthCard } from './GrowthCard.jsx'
import { LevelLadder } from './LevelLadder.jsx'

export function RatingPanel({ live, history, step }) {
  const t = useT()
  const gaps = live.parts.filter((p) => p.tip && p.tipGain > 0).sort((a, b) => b.tipGain - a.tipGain)
  const first = history[0]?.score
  return (
    <>
      <Panel glow className="hidden p-5 xl:block">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">{t('score')}</span>
          {first !== undefined && live.total > first && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-600 tabular-nums"><TrendingUp className="size-3.5" />+{live.total - first}</span>
          )}
        </div>
        <div className="mt-4 flex justify-center"><ScoreRing score={live.total} /></div>
        <LevelLadder score={live.total} />
      </Panel>

      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-900">{t('breakdown')}</span>
          <span className="text-xs tabular-nums text-stone-500" style={FONT_MONO}>{live.total}/100</span>
        </div>
        <ul className="space-y-3">
          {live.parts.map((p) => (
            <li key={p.key}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-stone-600"><p.icon className="size-3.5 text-stone-500" />{t(`crit_${p.key}`)}</span>
                <span className={cx('tabular-nums', p.points >= p.weight ? 'text-orange-600' : 'text-stone-500')} style={FONT_MONO}>{p.points}/{p.weight}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div className={cx('h-full rounded-full transition-all duration-700', p.points >= p.weight ? 'bg-orange-500' : 'bg-orange-300')} style={{ width: `${(p.points / p.weight) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {gaps.length > 0 && step > 1 && (
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-900"><Sparkles className="size-4 text-orange-600" />{t('raise')}</div>
          <ul className="space-y-2">
            {gaps.slice(0, 4).map((g) => (
              <li key={g.key} className="flex items-start justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-xs text-stone-500">{t(`crit_${g.key}`)}</div>
                  <div className="text-sm text-stone-700">{t(g.tip)}</div>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-orange-600" style={FONT_MONO}>{t('upTo')}{g.tipGain}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {history.length > 0 && <GrowthCard history={[...history.slice(0, step === 3 ? 2 : 1), { labelKey: 'hist_now', score: live.total }]} />}
    </>
  )
}
