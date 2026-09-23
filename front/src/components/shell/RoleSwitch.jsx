import { Briefcase, GraduationCap } from 'lucide-react'
import { cx } from '../../lib/cx.js'
import { useT } from '../../i18n/LangContext.jsx'

export function RoleSwitch({ role, onChange, compact, className }) {
  const t = useT()
  const items = [{ id: 'business', label: t('business'), icon: Briefcase }, { id: 'student', label: t('students'), icon: GraduationCap }]
  return (
    <div className={cx('grid grid-cols-2 rounded-xl border border-stone-200 bg-surface p-1', className)}>
      {items.map((i) => (
        <button key={i.id} type="button" onClick={() => onChange(i.id)} aria-pressed={role === i.id}
          className={cx('flex items-center justify-center gap-1.5 rounded-lg font-medium transition', compact ? 'h-7 px-2.5 text-xs' : 'h-8 text-xs',
            role === i.id ? 'bg-stone-100 text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800')}>
          <i.icon className="size-3.5" />{i.label}
        </button>
      ))}
    </div>
  )
}
