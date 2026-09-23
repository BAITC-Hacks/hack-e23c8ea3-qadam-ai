import { Sparkles } from 'lucide-react'
import { cx } from '../../lib/cx.js'
import { useT } from '../../i18n/LangContext.jsx'

export function AssistantBubble({ children, compact }) {
  const t = useT()
  return (
    <div className="flex items-start gap-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-orange-500 text-white shadow-[0_6px_16px_-8px_rgba(234,88,12,.7)]">
        <Sparkles className="size-4" />
      </div>
      <div className={cx('max-w-[85%] rounded-3xl rounded-tl-md border border-stone-200 bg-white text-sm leading-relaxed text-stone-600 shadow-[0_1px_2px_rgba(41,37,36,.04),0_8px_24px_-16px_rgba(41,37,36,.18)]', compact ? 'px-4 py-3' : 'px-4 py-3.5')}>
        {!compact && <div className="mb-1 text-xs font-medium text-orange-600">{t('assistantName')}</div>}
        {children}
      </div>
    </div>
  )
}
