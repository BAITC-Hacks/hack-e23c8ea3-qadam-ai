import { useId } from 'react'
import { Moon, Sun, Monitor, Palette } from 'lucide-react'
import { useT } from '../../i18n/LangContext.jsx'
import { useTheme } from '../../theme/ThemeContext.js'
import { cx } from '../../lib/cx.js'

const OPTIONS = [
  { value: 'light', icon: Sun, label: 'themeOptLight' },
  { value: 'dark', icon: Moon, label: 'themeOptDark' },
  { value: 'system', icon: Monitor, label: 'themeOptSystem' },
]

/** Тема: светлая / тёмная / системная. Тот же сегмент, что и выбор языка. */
export function ThemeToggle({ className }) {
  const t = useT()
  const { preference, setPreference } = useTheme()
  const groupName = useId()
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] uppercase tracking-[0.12em] text-stone-500"><Palette className="size-3.5" />{t('theme')}</div>
      <div role="radiogroup" aria-label={t('theme')} className="grid grid-cols-3 rounded-full border border-stone-200 bg-stone-100/70 p-1">
        {OPTIONS.map(({ value, icon: Icon, label }) => {
          const active = preference === value
          return (
            <label key={value} title={t(label)} className="min-w-0 cursor-pointer">
              <input type="radio" name={groupName} value={value} checked={active} onChange={() => setPreference(value)} className="peer sr-only" />
              <span className={cx('flex h-7 min-w-0 items-center justify-center gap-1 rounded-full px-1 text-[11px] font-medium transition peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400/70',
                active ? 'bg-surface text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800')}>
                <Icon aria-hidden="true" className={cx('size-3.5 shrink-0', active && 'text-orange-600')} />
                <span className="truncate">{t(label)}</span>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
