import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { THEME_STORAGE_KEY, isTheme, isThemePreference, readStoredTheme, resolveTheme, saveTheme } from './theme.js'

function memoryStorage(entries = []) {
  const values = new Map(entries)
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('only light and dark are valid explicit themes', () => {
  assert.equal(isTheme('light'), true)
  assert.equal(isTheme('dark'), true)
  for (const value of [undefined, null, '', 'system', 'Dark', ' dark ', '"dark"', 0, false, {}, []]) {
    assert.equal(isTheme(value), false)
  }
})

test('system is a valid preference but never a screen theme', () => {
  for (const p of ['light', 'dark', 'system']) assert.equal(isThemePreference(p), true)
  for (const p of [undefined, null, '', 'System', '"system"', 'auto']) assert.equal(isThemePreference(p), false)
})

test('system preference follows the OS appearance', () => {
  assert.equal(resolveTheme('system', true), 'dark')
  assert.equal(resolveTheme('system', false), 'light')
  assert.equal(resolveTheme('system'), 'light')
})

test('stored theme uses the dedicated key and plain string format', () => {
  assert.equal(THEME_STORAGE_KEY, 'qadam.theme')
  for (const theme of ['light', 'dark', 'system']) {
    assert.equal(readStoredTheme(memoryStorage([[THEME_STORAGE_KEY, theme]])), theme)
  }
})

test('missing and invalid stored preferences fall back to no preference', () => {
  assert.equal(readStoredTheme(memoryStorage()), null)
  for (const value of ['', 'auto', '"dark"', 'null']) {
    assert.equal(readStoredTheme(memoryStorage([[THEME_STORAGE_KEY, value]])), null)
  }
})

test('theme reads tolerate unavailable and blocked storage', () => {
  assert.equal(readStoredTheme(undefined), null)
  assert.equal(readStoredTheme(null), null)
  assert.equal(readStoredTheme({ getItem() { throw new Error('Storage blocked') } }), null)
})

test('explicit preference overrides both system appearances', () => {
  for (const theme of ['light', 'dark']) {
    assert.equal(resolveTheme(theme, true), theme)
    assert.equal(resolveTheme(theme, false), theme)
  }
})

test('missing and invalid preferences keep the original light UI', () => {
  for (const preferred of [undefined, null, '', 'auto', 'unexpected']) {
    assert.equal(resolveTheme(preferred, true), 'light')
    assert.equal(resolveTheme(preferred, false), 'light')
    assert.equal(resolveTheme(preferred), 'light')
  }
})

test('saving a theme survives a read without changing other stored data', () => {
  const storage = memoryStorage([['qadam.session', '{"draft":"keep me"}'], ['qadam.role', 'student']])
  for (const theme of ['dark', 'light', 'system']) {
    assert.equal(saveTheme(storage, theme), true)
    assert.equal(readStoredTheme(storage), theme)
    assert.equal(storage.values.get('qadam.session'), '{"draft":"keep me"}')
    assert.equal(storage.values.get('qadam.role'), 'student')
    assert.equal(storage.values.size, 3)
  }
})

test('invalid themes never overwrite a stored preference', () => {
  const storage = memoryStorage([[THEME_STORAGE_KEY, 'dark']])
  for (const theme of [undefined, null, '', 'auto', 'unexpected']) {
    assert.equal(saveTheme(storage, theme), false)
    assert.equal(readStoredTheme(storage), 'dark')
  }
})

test('theme writes tolerate unavailable, blocked, or full storage', () => {
  assert.equal(saveTheme(undefined, 'dark'), false)
  assert.equal(saveTheme(null, 'light'), false)
  assert.equal(saveTheme({ setItem() { throw new Error('Quota exceeded') } }, 'dark'), false)
})

test('pre-paint bootstrap agrees with the provider for saved and unavailable preferences', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  for (const systemDark of [undefined, false, true]) {
    for (const preferred of ['light', 'dark', null, 'system', 'auto', '"dark"', undefined]) {
      const documentElement = { dataset: {}, style: {} }
      const meta = {}
      const ctx = {
        localStorage: { getItem(key) {
          assert.equal(key, THEME_STORAGE_KEY)
          if (preferred === undefined) throw new Error('Storage blocked')
          return preferred
        } },
        document: { documentElement, querySelector: () => meta },
      }
      // systemDark undefined → no matchMedia at all
      if (systemDark !== undefined) ctx.matchMedia = () => ({ matches: systemDark })
      runInNewContext(script, ctx)
      const expected = resolveTheme(preferred, !!systemDark)
      assert.equal(documentElement.dataset.theme, expected, `${preferred} / ${systemDark}`)
      assert.equal(documentElement.style.colorScheme, expected)
      assert.equal(meta.content, expected === 'dark' ? '#1c1917' : '#F6F4F1')
    }
  }
})
