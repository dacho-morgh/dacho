// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import MobileNavigation from '@/components/landing/header/mobile-navigation'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

describe('landing mobile navigation', () => {
  it('closes when a link to the current page is clicked', () => {
    render(createElement(MobileNavigation))

    fireEvent.click(screen.getByRole('button', { name: 'باز کردن منو' }))

    const navigation = screen.getByRole('dialog')
    expect(navigation.getAttribute('aria-hidden')).toBe('false')

    fireEvent.click(screen.getByRole('link', { name: 'خانه' }))

    expect(navigation.getAttribute('aria-hidden')).toBe('true')
  })
})
