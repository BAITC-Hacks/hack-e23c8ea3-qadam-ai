import { CircleCheck, CircleAlert, Info } from 'lucide-react'
import { cx } from '../../lib/cx.js'

export function Toast({ tone, text }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-8">
      <div className={cx('q-in flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-2xl backdrop-blur-xl',
        tone === 'ok' ? 'border-orange-200 bg-white text-stone-900' : tone === 'warn' ? 'border-amber-200 bg-white text-amber-800' : 'border-stone-300 bg-white text-stone-700')}>
        {tone === 'ok' ? <CircleCheck className="size-4 text-orange-600" /> : tone === 'warn' ? <CircleAlert className="size-4" /> : <Info className="size-4" />}
        {text}
      </div>
    </div>
  )
}
