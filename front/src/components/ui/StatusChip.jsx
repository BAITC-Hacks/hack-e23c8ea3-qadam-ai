import { cx } from '../../lib/cx.js'
import { useT } from '../../i18n/LangContext.jsx'

export function StatusChip({ status }) {
  const t = useT()
  const m = {
    pending: ['status_pending', 'text-stone-600 bg-stone-100 border-stone-300'],
    accepted: ['status_accepted', 'text-emerald-700 bg-emerald-50 border-emerald-200'],
    rejected: ['status_rejected', 'text-rose-700 bg-rose-50 border-rose-200'],
  }[status]
  return <span className={cx('rounded-full border px-2 py-0.5 text-[11px] font-medium', m[1])}>{t(m[0])}</span>
}
