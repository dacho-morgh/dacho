'use client'

import React, { createContext, useCallback, use, useEffect, useState } from 'react'

import type { Theme, ThemeContextType } from './types'

import { canUseDOM } from '@dacho/cms-core/utilities'
import { defaultTheme, themeLocalStorageKey } from './shared'

const initialContext: ThemeContextType = {
  setTheme: () => null,
  theme: defaultTheme,
}

const ThemeContext = createContext(initialContext)

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme | undefined>(
    canUseDOM ? ((document.documentElement.getAttribute('data-theme') as Theme) || 'light') : 'light',
  )

  const setTheme = useCallback((_themeToSet: Theme | null) => {
    setThemeState('light')
    window.localStorage.setItem(themeLocalStorageKey, 'light')
    document.documentElement.setAttribute('data-theme', 'light')
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    setThemeState('light')
  }, [])

  return <ThemeContext value={{ setTheme, theme }}>{children}</ThemeContext>
}

export const useTheme = (): ThemeContextType => use(ThemeContext)
