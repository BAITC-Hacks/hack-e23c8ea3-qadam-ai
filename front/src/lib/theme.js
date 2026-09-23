/** Theme helpers stay browser-independent so bootstrap and React can share them. */
export const THEME_STORAGE_KEY = 'qadam.theme'
/** Что выбирает человек: светлая, тёмная или как в системе. */
export const THEME_PREFERENCES = ['light', 'dark', 'system']

/** Итоговая тема на экране — только light или dark. */
export function isTheme(value) {
  return value === 'light' || value === 'dark'
}

export function isThemePreference(value) {
  return THEME_PREFERENCES.includes(value)
}

/** Read a plain preference string; unavailable or invalid storage is no preference. */
export function readStoredTheme(storage) {
  try {
    const value = storage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(value) ? value : null
  } catch {
    return null
  }
}

/**
 * Preference → theme on screen. 'system' follows the OS (systemDark);
 * no preference keeps the original light product UI.
 */
export function resolveTheme(preferred, systemDark = false) {
  if (preferred === 'system') return systemDark ? 'dark' : 'light'
  return isTheme(preferred) ? preferred : 'light'
}

/** Save only this preference; blocked storage must not prevent a theme change. */
export function saveTheme(storage, preference) {
  if (!isThemePreference(preference)) return false
  try {
    storage.setItem(THEME_STORAGE_KEY, preference)
    return true
  } catch {
    return false
  }
}
