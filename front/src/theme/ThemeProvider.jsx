import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { THEME_STORAGE_KEY, isThemePreference, readStoredTheme, resolveTheme, saveTheme } from '../lib/theme.js'
import { ThemeContext } from './ThemeContext.js'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function storedPreference() {
  try { return readStoredTheme(window.localStorage) } catch { return null }
}

function systemPrefersDark() {
  try { return window.matchMedia(DARK_QUERY).matches } catch { return false }
}

export function ThemeProvider({ children }) {
  // preference: 'light' | 'dark' | 'system' | null (не выбрано → светлая)
  const [preference, setPreferenceState] = useState(storedPreference)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  const theme = resolveTheme(preference, systemDark)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1c1917' : '#F6F4F1')
  }, [theme])

  // «Системная»: следим за сменой темы ОС на лету.
  useEffect(() => {
    let mq
    try { mq = window.matchMedia(DARK_QUERY) } catch { return undefined }
    const onChange = (e) => setSystemDark(e.matches)
    // Подстраховка: некоторые окружения не шлют change — перечитываем при возврате на вкладку.
    const recheck = () => setSystemDark(mq.matches)
    mq.addEventListener?.('change', onChange)
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      mq.removeEventListener?.('change', onChange)
      window.removeEventListener('focus', recheck)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [])

  useEffect(() => {
    const onStorageChange = (event) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setPreferenceState(isThemePreference(event.newValue) ? event.newValue : null)
      }
    }
    window.addEventListener('storage', onStorageChange)
    return () => {
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  const setPreference = useCallback((next) => {
    if (!isThemePreference(next)) return
    setPreferenceState(next)
    // Private mode may block storage; switching still works for this tab.
    try { saveTheme(window.localStorage, next) } catch { /* storage unavailable */ }
  }, [])

  const toggleTheme = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [theme, setPreference])

  const value = useMemo(
    () => ({ theme, preference: preference || 'light', setPreference, toggleTheme }),
    [theme, preference, setPreference, toggleTheme],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
