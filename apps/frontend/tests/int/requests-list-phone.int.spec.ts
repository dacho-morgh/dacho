// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RequestsListView, type RequestItem } from '@/components/dashboard/requests'

const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, refresh: vi.fn() }),
  usePathname: () => '/dashboard/requests',
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const item: RequestItem = {
  id: 'req-1',
  trackingCode: 'T-1',
  title: 'همایش نفت و گاز با عنوانی بسیار بلند برای بررسی شکستن خط در صفحه کوچک',
  status: 'in_review',
  statusLabel: 'در حال داوری',
  stage: 'reviewing',
  currentStep: '',
  nextAction: 'منتظر بررسی؛ اقدامی از شما لازم نیست',
  revision: 2,
  allowedActions: [],
  dueDate: '۱۴۰۵/۰۱/۰۶',
  createdDate: '۱۴۰۵/۰۱/۰۵',
}

describe('company request list on a phone (design QA #280)', () => {
  it('has a card per request below md and keeps the table for md and up', () => {
    const { container } = render(createElement(RequestsListView, { items: [item], state: 'default' }))
    const table = container.querySelector('table')!
    expect(table.className).toContain('hidden')
    expect(table.className).toContain('md:table')
    const list = screen.getByRole('list', { name: 'درخواست‌ها' })
    expect(list.className).toContain('md:hidden')
    const card = within(list).getByTestId('request-card')
    // The same facts as the row, with the full title wrapping instead of collapsing.
    expect(within(card).getByRole('link', { name: item.title }).getAttribute('href')).toBe('/dashboard/requests/req-1')
    expect(card.textContent).toContain('در حال داوری')
    expect(card.textContent).toContain('کد پیگیری: T-1')
    expect(card.textContent).toContain('اقدام شما: منتظر بررسی')
    expect(card.textContent).toContain('۱۴۰۵/۰۱/۰۶')
    expect(card.textContent).toContain('۱۴۰۵/۰۱/۰۵')
  })

  it('opens the dossier from a click anywhere on the card', () => {
    render(createElement(RequestsListView, { items: [item], state: 'default' }))
    fireEvent.click(within(screen.getByTestId('request-card')).getByText('کد پیگیری: T-1'))
    expect(nav.push).toHaveBeenCalledWith('/dashboard/requests/req-1')
  })
})
