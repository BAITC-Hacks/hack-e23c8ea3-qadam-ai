import { Moon, Sun } from 'lucide-react'
import { useT } from '../../i18n/LangContext.jsx'
import { useTheme } from '../../theme/ThemeContext.js'
import { cx } from '../../lib/cx.js'

export function ThemeToggle() {
  const t = useT()
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const Icon = dark ? Moon : Sun
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label={t('themeDark')}
      onClick={toggleTheme}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-stone-200 bg-surface px-3 py-2.5 text-left text-xs text-stone-700 transition-colors hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70">
      <Icon aria-hidden="true" className="size-4 text-orange-600" />
      <span>{t(dark ? 'themeDark' : 'themeLight')}</span>
      <span aria-hidden="true" className={cx('ml-auto flex h-5 w-9 shrink-0 items-center rounded-full p-0.5', dark ? 'bg-orange-500' : 'bg-stone-300')}>
        <span className={cx('size-4 rounded-full bg-surface shadow-sm transition-transform motion-reduce:transition-none', dark && 'translate-x-4')} />
      </span>
    </button>
  )
}
