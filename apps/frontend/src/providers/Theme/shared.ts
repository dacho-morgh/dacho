import type { Theme, ThemePreference } from './types'

export const themeLocalStorageKey = 'dacho-theme'

export const defaultTheme: Theme = 'light'

export const defaultPreference: ThemePreference = 'system'

export const darkSchemeQuery = '(prefers-color-scheme: dark)'

/** Dark mode only exists inside the dashboard; the public site stays light. */
export const isThemedPath = (pathname: null | string): boolean =>
  pathname === '/dashboard' || Boolean(pathname?.startsWith('/dashboard/'))

export const resolveTheme = (preference: ThemePreference, systemIsDark: boolean): Theme =>
  preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference

export const getImplicitPreference = (): Theme => defaultTheme
