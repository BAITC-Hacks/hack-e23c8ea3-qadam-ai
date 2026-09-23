import { FONT_DISPLAY } from '../../lib/scoring.js'

export function PageHead({ eyebrow, title, sub, right }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-orange-600">{eyebrow}</div>}
        <h1 className="text-2xl text-stone-900 sm:text-[28px]" style={{ ...FONT_DISPLAY, fontWeight: 600, letterSpacing: '-0.015em', textWrap: 'balance' }}>{title}</h1>
        {sub && <p className="mt-2 max-w-xl text-sm text-stone-500">{sub}</p>}
      </div>
      {right}
    </div>
  )
}
