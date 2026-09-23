import { cx } from '../../lib/cx.js'
import { useT } from '../../i18n/LangContext.jsx'

export function TeamPicker({ teams, teamId, onChange, className, compact }) {
  const tr = useT()
  const list = Array.isArray(teams) ? teams : []
  const t = list.find((x) => x.id === teamId) || list[0]
  if (!t) return null
  return (
    <div className={cx('rounded-xl border border-stone-200 bg-surface p-3', className)}>
      <label htmlFor={compact ? 'team-m' : 'team'} className="text-[11px] uppercase tracking-[0.12em] text-stone-500">{tr('youTeam')}</label>
      <select id={compact ? 'team-m' : 'team'} value={t.id} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm font-medium text-stone-900 outline-none">
        {list.map((x) => <option key={x.id} value={x.id} className="bg-surface">{x.name}</option>)}
      </select>
      <div className="mt-2 flex flex-wrap gap-1">
        {(t.skills || []).map((s) => <span key={s} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">{s}</span>)}
      </div>
    </div>
  )
}
