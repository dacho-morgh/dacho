export type Theme = 'light' | 'dark'

export type ThemePreference = Theme | 'system'

export interface ThemeContextType {
  /** The theme currently applied to the page. */
  theme: Theme
  /** What the user picked; `system` follows the OS setting. */
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

export function themeIsValid(string: null | string): string is Theme {
  return string === 'light' || string === 'dark'
}

export function preferenceIsValid(string: null | string): string is ThemePreference {
  return string === 'system' || themeIsValid(string)
}
