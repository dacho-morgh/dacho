// @vitest-environment jsdom

import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button asChild', () => {
  it('forwards button props to its child without rendering through a Fragment', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const { container } = render(
        createElement(
          Button,
          { asChild: true },
          createElement('a', { href: '/cooperation' }, 'Cooperate'),
        ),
      )

      const errors = consoleError.mock.calls.flat().join(' ')
      const link = container.querySelector('a')

      expect(errors).not.toContain('supplied to `React.Fragment`')
      expect(link?.getAttribute('data-slot')).toBe('button')
    } finally {
      consoleError.mockRestore()
    }
  })
})
