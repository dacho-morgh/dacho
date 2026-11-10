// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { ProfileNavigation } from '@/components/dashboard/profile/profile-navigation'
import { SidebarProvider } from '@/components/ui/sidebar'

let pathname = '/dashboard/requests'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('@/components/dashboard/user-menu', () => ({
  UserMenu: () => null,
}))

afterEach(() => {
  cleanup()
})

function mockDesktop() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('main sidebar active state', () => {
  it('colors the active label brand and keeps inactive labels neutral', () => {
    mockDesktop()
    pathname = '/dashboard/requests'

    render(
      createElement(
        SidebarProvider,
        null,
        createElement(AppSidebar, {
          navigation: {
            role: 'reviewer',
            roleLabel: 'کارشناس',
            responsibilities: [],
            destinations: ['/dashboard', '/dashboard/requests'],
          },
        }),
      ),
    )

    const active = screen.getByText('درخواست‌ها')
    const inactive = screen.getByText('داشبورد')

    // Typography defaults to text-foreground; the label must inherit the button color instead.
    expect(active.className).toContain('text-inherit')
    expect(active.className).not.toContain('text-foreground')
    expect(active.closest('[data-active="true"]')?.className).toContain('text-brand-600')
    expect(active.closest('[data-active="true"]')?.className).not.toContain('px-3')
    expect(active.closest('a')?.className).toContain('gap-2')
    expect(active.closest('a')?.className).not.toContain('gap-2.5')
    expect(inactive.closest('[data-active="false"]')?.className).toContain('text-neutral-600')
  })
})

describe('profile sidebar', () => {
  it('is sticky on desktop, RTL, with a brand active label and indicator at the start edge', () => {
    pathname = '/dashboard/profile/resume'
    render(createElement(ProfileNavigation))

    const nav = screen.getByRole('navigation', { name: 'بخش‌های پروفایل' })
    expect(nav.getAttribute('dir')).toBe('rtl')
    expect(nav.className).toContain('lg:sticky')
    expect(nav.className).toContain('lg:self-start')
    expect(nav.className).toContain('lg:w-[200px]')
    expect(nav.className).not.toMatch(/(?:^|\s)(?:left|right|pl|pr|ml|mr)-/)

    const active = screen.getByRole('link', { name: 'رزومه' })
    expect(active.getAttribute('aria-current')).toBe('page')
    expect(active.className).toContain('text-brand-600')
    expect(active.className).toContain('bg-brand-50')
    // The indicator is the row's first child, so it sits at the inline-start (right) edge in RTL.
    const indicator = active.parentElement?.firstElementChild
    expect(indicator?.className).toContain('bg-brand-500')

    const inactive = screen.getByRole('link', { name: 'پروفایل شرکت' })
    expect(inactive.getAttribute('aria-current')).toBeNull()
    expect(inactive.className).toContain('text-neutral-600')
    // Figma rows use 8px padding.
    expect(inactive.className).toContain('p-2')
    expect(inactive.className).not.toContain('px-3')

    const logout = screen.getByRole('button', { name: 'خروج از حساب کاربری' })
    expect(logout.className).toContain('font-[325]')
    expect(logout.className).not.toContain('font-[450]')
    expect(logout.className).not.toContain('px-3')
  })

  it('uses the same navigation for staff panels', () => {
    pathname = '/dashboard/profile/staff'
    render(createElement(ProfileNavigation, { staffMode: true }))

    const active = screen.getByRole('link', { name: 'اطلاعات پروفایل' })
    expect(active.className).toContain('text-brand-600')
    expect(screen.getByRole('button', { name: 'خروج از حساب کاربری' })).toBeTruthy()
  })
})
