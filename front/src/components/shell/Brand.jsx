import { FONT_DISPLAY } from '../../lib/scoring.js'
import { useT } from '../../i18n/LangContext.jsx'

export function Brand({ compact }) {
  const t = useT()
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl bg-orange-500 text-on-accent" style={{ boxShadow: '0 8px 20px -8px rgba(234,88,12,.6)' }}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18h5v-5h5V8h6" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] text-stone-900" style={{ ...FONT_DISPLAY, fontWeight: 600 }}>Qadam<span className="text-orange-600"> AI</span></div>
        {!compact && <div className="text-[11px] text-stone-500">{t('tagline')}</div>}
      </div>
    </div>
  )
}
