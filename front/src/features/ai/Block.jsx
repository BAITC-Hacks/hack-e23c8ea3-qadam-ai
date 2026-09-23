import { FONT_MONO } from '../../lib/scoring.js'

export function Block({ title, children }) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-stone-500">{title}</div>
      <pre className="max-h-56 overflow-auto rounded-xl border border-stone-200 bg-surface p-3 text-[12px] leading-relaxed text-stone-600 whitespace-pre-wrap" style={FONT_MONO}>{children}</pre>
    </div>
  )
}
