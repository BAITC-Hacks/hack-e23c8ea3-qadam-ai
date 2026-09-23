import { cx } from '../../lib/cx.js'
import { FONT_MONO, LEVELS, levelOf } from '../../lib/scoring.js'
import { useT } from '../../i18n/LangContext.jsx'

export function LevelLadder({ score }) {
  const t = useT()
  return (
    <div className="mt-5 grid grid-cols-4 gap-1.5">
      {[...LEVELS].reverse().map((l, i, arr) => {
        const max = i < arr.length - 1 ? arr[i + 1].min - 1 : 100
        const active = levelOf(score).key === l.key
        return (
          <div key={l.key} className={cx('rounded-lg border px-2 py-2 text-center transition', active ? l.chip : 'border-stone-200 text-stone-400')}>
            <div className="text-[10px] font-medium leading-tight">{t(`level_${l.key}`)}</div>
            <div className="mt-0.5 text-[10px] tabular-nums opacity-70" style={FONT_MONO}>{l.min}–{max}</div>
          </div>
        )
      })}
    </div>
  )
}
