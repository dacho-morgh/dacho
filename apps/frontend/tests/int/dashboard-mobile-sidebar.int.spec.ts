// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import DashboardLayout from '@/app/(frontend)/dashboard/layout'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('dashboard mobile sidebar', () => {
  it('uses a compact absolute hamburger trigger at the top-left and opens from the right', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    render(createElement(DashboardLayout, null, createElement('div', null, 'Dashboard content')))

    const trigger = screen.getByRole('button', { name: 'باز کردن منو' })

    expect(trigger.className).toContain('absolute')
    expect(trigger.className).toContain('top-6')
    expect(trigger.className).toContain('left-6')
    expect(trigger.className).toContain('size-10')
    expect(trigger.className).toContain('md:hidden')
    expect(trigger.querySelector('svg')).not.toBeNull()

    fireEvent.click(trigger)

    await waitFor(() => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"][data-mobile="true"]')

      expect(sidebar).not.toBeNull()
      expect(sidebar?.getAttribute('data-side')).toBe('right')
    })
  })
})
