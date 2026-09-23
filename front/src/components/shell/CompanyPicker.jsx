import { cx } from '../../lib/cx.js'
import { useT } from '../../i18n/LangContext.jsx'
import { FONT_DISPLAY } from '../../lib/scoring.js'

export function CompanyPicker({ companies, companyId, onChange, className, compact }) {
  const tr = useT()
  const company = companies.find((c) => c.id === companyId) || companies[0]
  const initial = company?.contactName?.[0] || company?.name?.[0] || '?'

  return (
    <div className={cx('rounded-3xl border border-stone-200 bg-white p-3', className)}>
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700" style={FONT_DISPLAY}>
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={compact ? 'company-m' : 'company'} className="text-[11px] uppercase tracking-[0.12em] text-stone-500">
            {tr('youCompany')}
          </label>
          <select
            id={compact ? 'company-m' : 'company'}
            value={company?.id}
            onChange={(e) => onChange(e.target.value)}
            className="mt-0.5 w-full truncate bg-transparent text-sm font-medium text-stone-900 outline-none"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id} className="bg-white">{c.name}</option>
            ))}
          </select>
          <div className="truncate text-xs text-stone-500">
            {company?.contactName}, {tr(company?.roleLabelKey || 'managerRole')}
          </div>
        </div>
      </div>
    </div>
  )
}
