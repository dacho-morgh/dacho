'use client'

import { usePathname } from 'next/navigation'
import React, { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'

import type { ThemeContextType, ThemePreference } from './types'

import {
  darkSchemeQuery,
  defaultPreference,
  defaultTheme,
  isThemedPath,
  resolveTheme,
  themeLocalStorageKey,
} from './shared'
import { preferenceIsValid } from './types'

const initialContext: ThemeContextType = {
  preference: defaultPreference,
  setPreference: () => null,
  theme: defaultTheme,
}

const ThemeContext = createContext(initialContext)

let memoryPreference: ThemePreference = defaultPreference
const preferenceListeners = new Set<() => void>()

const readPreference = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(themeLocalStorageKey)
    return preferenceIsValid(stored) ? stored : memoryPreference
  } catch {
    return memoryPreference
  }
}

const subscribePreference = (onChange: () => void) => {
  preferenceListeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    preferenceListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

const subscribeSystem = (onChange: () => void) => {
  const query = window.matchMedia(darkSchemeQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const readSystemIsDark = () => window.matchMedia(darkSchemeQuery).matches

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const preference = useSyncExternalStore(subscribePreference, readPreference, () => defaultPreference)
  const systemIsDark = useSyncExternalStore(subscribeSystem, readSystemIsDark, () => false)

  const theme = isThemedPath(pathname) ? resolveTheme(preference, systemIsDark) : defaultTheme

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const setPreference = useCallback((next: ThemePreference) => {
    memoryPreference = next
    try {
      window.localStorage.setItem(themeLocalStorageKey, next)
    } catch {
      // Storage can be blocked; the choice still applies for this visit.
    }
    preferenceListeners.forEach((listener) => listener())
  }, [])

  const value = useMemo(() => ({ preference, setPreference, theme }), [preference, setPreference, theme])

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export const useTheme = (): ThemeContextType => use(ThemeContext)
