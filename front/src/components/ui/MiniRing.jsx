import { cx } from '../../lib/cx.js'
import { FONT_MONO, levelOf } from '../../lib/scoring.js'

export function MiniRing({ score, size = 44 }) {
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const l = levelOf(score)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--q-chart-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
          className={cx(l.key === 'priority' ? 'stroke-orange-500' : l.key === 'ready' ? 'stroke-emerald-500' : l.key === 'working' ? 'stroke-amber-400' : 'stroke-stone-300')} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tabular-nums text-stone-900" style={FONT_MONO}>{score}</span>
    </div>
  )
}
