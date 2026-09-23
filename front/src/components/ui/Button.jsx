import { cx } from '../../lib/cx.js'

export function Button({ variant = 'ghost', size = 'md', className, children, ...props }) {
  const v = {
    primary: 'bg-orange-500 text-white hover:bg-orange-600 font-semibold shadow-[0_8px_20px_-8px_rgba(234,88,12,.55)] disabled:bg-stone-100 disabled:text-stone-500 disabled:shadow-none',
    ghost: 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 hover:border-stone-300',
    quiet: 'text-stone-500 hover:text-stone-900 hover:bg-stone-100',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
    danger: 'text-stone-500 border border-stone-200 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50',
  }[variant]
  const s = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-sm gap-2' }[size]
  return (
    <button type="button" className={cx('inline-flex items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60', v, s, className)} {...props}>
      {children}
    </button>
  )
}
