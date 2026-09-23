import { cx } from '../../lib/cx.js'
import { FONT_DISPLAY, levelOf } from '../../lib/scoring.js'
import { useT } from '../../i18n/LangContext.jsx'

export function ScoreRing({ score, size = 160, stroke = 12, label = true }) {
  const t = useT()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const l = levelOf(score)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ece8e4" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f97316" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)', filter: 'drop-shadow(0 4px 10px rgba(234,88,12,.25))' }} />
        {[40, 70, 90].map((tick) => (
          <circle key={tick} cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff" strokeWidth={stroke + 1}
            strokeDasharray={`1.5 ${c}`} strokeDashoffset={-(c * tick) / 100} />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular-nums text-stone-900 leading-none" style={{ ...FONT_DISPLAY, fontSize: size * 0.27, fontWeight: 600 }}>{score}</span>
        {label && <span className={cx('mt-1.5 text-[11px] uppercase tracking-[0.14em]', l.text)}>{t(`level_${l.key}`)}</span>}
      </div>
    </div>
  )
}
