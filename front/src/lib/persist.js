/** localStorage helpers for demo persistence (AGENTS.md — Arsen). */

const PREFIX = 'qadam.'

export const STORAGE_KEYS = {
  session: `${PREFIX}session`,
  role: `${PREFIX}role`,
  teamId: `${PREFIX}teamId`,
  companyId: `${PREFIX}companyId`,
  view: `${PREFIX}view`,
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 */
export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode */
  }
}

/** @param {string} key */
export function removeKey(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
