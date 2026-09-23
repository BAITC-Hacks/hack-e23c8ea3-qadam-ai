import { cx } from '../../lib/cx.js'
import { inputCls } from '../../components/ui/inputCls.js'

export function FormInput({ id, label, value, onChange, ph, area, err }) {
  const El = area ? 'textarea' : 'input'
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-stone-500">{label}</label>
      <El id={id} value={value} rows={area ? 2 : undefined} placeholder={ph} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, 'resize-none py-2', err && 'border-rose-300')} />
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
    </div>
  )
}
