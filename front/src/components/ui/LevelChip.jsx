import { cx } from '../../lib/cx.js'
import { levelOf } from '../../lib/scoring.js'
import { useT } from '../../i18n/LangContext.jsx'

export function LevelChip({ score, className }) {
  const t = useT()
  const l = levelOf(score)
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium', l.chip, className)}>
      <span className={cx('size-1.5 rounded-full', l.dot)} />
      {t(`level_${l.key}`)}
    </span>
  )
}
