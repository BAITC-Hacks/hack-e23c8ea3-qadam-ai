/** Theme helpers stay browser-independent so bootstrap and React can share them. */
export const THEME_STORAGE_KEY = 'qadam.theme'

export function isTheme(value) {
  return value === 'light' || value === 'dark'
}

/** Read a plain theme string; unavailable or invalid storage is no preference. */
export function readStoredTheme(storage) {
  try {
    const value = storage.getItem(THEME_STORAGE_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

export function resolveTheme(preferred) {
  // First paint matches the original light product UI unless the user chose a theme.
  return isTheme(preferred) ? preferred : 'light'
}

/** Save only this preference; blocked storage must not prevent a theme change. */
export function saveTheme(storage, theme) {
  if (!isTheme(theme)) return false
  try {
    storage.setItem(THEME_STORAGE_KEY, theme)
    return true
  } catch {
    return false
  }
}
