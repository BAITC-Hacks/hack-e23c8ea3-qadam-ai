import { cx } from '../../lib/cx.js'
import { ACCENT_GLOW } from '../../lib/scoring.js'

export function Panel({ className, glow, children }) {
  return (
    <div className={cx('rounded-3xl border border-stone-200/80 bg-surface shadow-[0_1px_2px_rgba(41,37,36,.04),0_12px_32px_-20px_rgba(41,37,36,.18)]', className)} style={glow ? { boxShadow: ACCENT_GLOW } : undefined}>
      {children}
    </div>
  )
}
