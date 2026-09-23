import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Check, Globe, Braces, RotateCcw } from 'lucide-react'
import { cx } from '../lib/cx.js'
import ru from './ru.js'
import kk from './kk.js'
import en from './en.js'

export const LANGS = [
  { code: 'kk', short: 'ҚАЗ', name: 'Қазақша' },
  { code: 'ru', short: 'РУС', name: 'Русский' },
  { code: 'en', short: 'ENG', name: 'English' },
]

export const I18N = { ru, kk, en }

function detectLang() {
  try {
    const saved = localStorage.getItem('qadam.lang')
    if (saved && I18N[saved]) return saved
  } catch { /* ignore */ }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'ru').slice(0, 2).toLowerCase()
  return I18N[nav] ? nav : 'ru'
}

const LangCtx = createContext(null)

export function useLang() {
  const ctx = useContext(LangCtx)
  return ctx
}

export function useT() {
  const ctx = useContext(LangCtx)
  return ctx.t
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try { localStorage.setItem('qadam.lang', lang) } catch { /* ignore */ }
  }, [lang])

  const t = useCallback((k, vars) => {
    let s = I18N[lang]?.[k] ?? I18N.ru[k] ?? k
    if (vars) Object.entries(vars).forEach(([key, val]) => { s = s.replaceAll(`{${key}}`, String(val)) })
    return s
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t])

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

/** Desktop: сегмент в сайдбаре. */
export function LangSwitch({ className }) {
  const t = useT()
  const { lang, setLang } = useLang()
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] uppercase tracking-[0.12em] text-stone-500"><Globe className="size-3.5" />{t('language')}</div>
      <div role="radiogroup" aria-label={t('language')} className="grid grid-cols-3 rounded-full border border-stone-200 bg-stone-100/70 p-1">
        {LANGS.map((l) => (
          <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} title={l.name} onClick={() => setLang(l.code)}
            className={cx('h-7 rounded-full text-[11px] font-semibold tracking-wide transition', lang === l.code ? 'bg-surface text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800')}>
            {l.short}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Mobile: кнопка «🌐 РУС» в шапке открывает нижнюю шторку-меню. */
export function MobileMenu({ themeControl, onAI, onReset, onClose }) {
  const t = useT()
  const { lang, setLang } = useLang()
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:hidden">
      <div className="absolute inset-0 bg-overlay/30 backdrop-blur-sm" onClick={onClose} />
      <div className="q-in relative w-full rounded-t-3xl border-t border-stone-200 bg-surface px-4 pt-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
        <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] uppercase tracking-[0.12em] text-stone-500"><Globe className="size-3.5" />{t('language')}</div>
        <div className="space-y-1">
          {LANGS.map((l) => (
            <button key={l.code} type="button" onClick={() => { setLang(l.code); onClose() }}
              className={cx('flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] transition', lang === l.code ? 'bg-orange-50 text-stone-900' : 'text-stone-700 hover:bg-stone-100')}>
              <span>{l.name}</span>
              <span className="flex items-center gap-2 text-xs text-stone-500">{l.short}{lang === l.code && <Check className="size-4 text-orange-600" />}</span>
            </button>
          ))}
        </div>
        <div className="my-3 h-px bg-stone-200" />
        {themeControl}
        <div className="my-3 h-px bg-stone-200" />
        <button type="button" onClick={() => { onAI(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-stone-700 hover:bg-stone-100"><Braces className="size-4 text-orange-600" />{t('howAI')}</button>
        <button type="button" onClick={() => { onReset(); onClose() }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-stone-500 hover:bg-stone-100"><RotateCcw className="size-4" />{t('reset')}</button>
      </div>
    </div>
  )
}
