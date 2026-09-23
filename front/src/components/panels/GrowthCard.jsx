import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Panel } from '../ui/Panel.jsx'
import { FONT_DISPLAY, formatScoreDelta } from '../../lib/scoring.js'
import { useT } from '../../i18n/LangContext.jsx'

export function GrowthCard({ history }) {
  const t = useT()
  const w = 280, h = 72, pad = 8
  const pts = history.map((p, i) => [pad + (i * (w - pad * 2)) / Math.max(1, history.length - 1), h - pad - (p.score / 100) * (h - pad * 2)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
  const delta = history[history.length - 1].score - history[0].score
  const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const labelOf = (p) => (p.labelKey ? t(p.labelKey) : p.label)
  return (
    <Panel className="p-5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">{t('growth')}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl text-orange-600 tabular-nums" style={{ ...FONT_DISPLAY, fontWeight: 600 }}>{formatScoreDelta(delta)}</span>
            <span className="text-xs text-stone-500">{t('fromDraft')}</span>
          </div>
        </div>
        <DeltaIcon aria-hidden="true" className="size-5 text-orange-600" />
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" style={{ maxWidth: '100%' }}>
        {[40, 70, 90].map((tick) => <line key={tick} x1={pad} x2={w - pad} y1={h - pad - (tick / 100) * (h - pad * 2)} y2={h - pad - (tick / 100) * (h - pad * 2)} stroke="var(--q-chart-track)" strokeDasharray="2 4" />)}
        <path d={`${d} L${pts[pts.length - 1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`} fill="rgba(249,115,22,.10)" />
        <path d={d} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2.5} fill={i === pts.length - 1 ? '#ea580c' : 'var(--color-surface)'} stroke="#f97316" strokeWidth="1.5" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-stone-500">
        {history.map((p, i) => <span key={i} className="tabular-nums">{labelOf(p)} · {p.score}</span>)}
      </div>
    </Panel>
  )
}
