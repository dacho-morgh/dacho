'use client'

import { Direction } from 'radix-ui'
import type { ReactNode } from 'react'

/**
 * Radix primitives write their own `dir` (ScrollArea defaults to "ltr", which
 * flips every table inside it). The dashboard is Persian, so give them all RTL.
 */
export function DirectionProvider({ dir = 'rtl', children }: { dir?: 'rtl' | 'ltr'; children: ReactNode }) {
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>
}
