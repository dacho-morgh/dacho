'use client'

import { darkSchemeQuery, themeLocalStorageKey } from '../shared'

// Runs before first paint so the dashboard never flashes the wrong theme.
// Mirrors `isThemedPath` / `resolveTheme` in ../shared.
const initThemeScript = `
  (function () {
    var root = document.documentElement;
    var theme = 'light';
    try {
      var path = window.location.pathname;
      if (path === '/dashboard' || path.indexOf('/dashboard/') === 0) {
        var stored = window.localStorage.getItem('${themeLocalStorageKey}');
        var preference = stored === 'light' || stored === 'dark' ? stored : 'system';
        theme = preference === 'system'
          ? (window.matchMedia('${darkSchemeQuery}').matches ? 'dark' : 'light')
          : preference;
      }
    } catch (error) {}
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  })();
`

export const InitTheme = () => {
  if (typeof window !== 'undefined') return null

  return (
    <script
      dangerouslySetInnerHTML={{ __html: initThemeScript }}
      id="theme-script"
      suppressHydrationWarning
    />
  )
}
