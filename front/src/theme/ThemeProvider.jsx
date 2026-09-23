import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { THEME_STORAGE_KEY, isTheme, readStoredTheme, resolveTheme, saveTheme } from '../lib/theme.js'
import { ThemeContext } from './ThemeContext.js'

function storedPreference() {
  try { return readStoredTheme(window.localStorage) } catch { return null }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(storedPreference)
  const theme = resolveTheme(preference)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1c1917' : '#F6F4F1')
  }, [theme])

  useEffect(() => {
    const onStorageChange = (event) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setPreference(isTheme(event.newValue) ? event.newValue : null)
      }
    }
    window.addEventListener('storage', onStorageChange)
    return () => {
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setPreference(next)
    // Private mode may block storage; switching still works for this tab.
    try { saveTheme(window.localStorage, next) } catch { /* storage unavailable */ }
  }, [theme])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
