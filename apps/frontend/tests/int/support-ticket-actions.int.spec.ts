// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SupportTicketActions } from '@/components/dashboard/support-ticket-actions'

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const initialMessages = [{
  id: 'message-1', authorId: 'company-1', authorRole: 'applicant' as const,
  body: 'پیام شرکت', createdAt: '2026-09-18T08:00:00Z',
}]

describe('SupportTicketActions', () => {
  it.each([
    ['company', false],
    ['admin', true],
  ] as const)('lets %s reply to and cancel an open ticket', async (_name, isAdmin) => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: {
        id: 'ticket-1', status: isAdmin ? 'answered' : 'open', messages: [...initialMessages, {
          id: 'message-2', authorId: isAdmin ? 'staff-1' : 'company-1', authorRole: isAdmin ? 'staff' : 'applicant',
          body: 'پاسخ جدید', createdAt: '2026-09-18T09:00:00Z',
        }],
      } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ticket: { id: 'ticket-1', status: 'closed', messages: initialMessages } })))
    vi.stubGlobal('fetch', request)
    render(createElement(SupportTicketActions, { id: 'ticket-1', status: 'open', isAdmin, initialMessages }))

    fireEvent.change(screen.getByLabelText('پاسخ جدید'), { target: { value: ' پاسخ جدید ' } })
    fireEvent.click(screen.getByRole('button', { name: 'ارسال پاسخ' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/dashboard/support/ticket-1/respond', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ body: 'پاسخ جدید' }),
    })))
    await waitFor(() => expect(screen.getByText('پاسخ شما ارسال شد.')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'لغو تیکت' }))
    await waitFor(() => expect(screen.getByText('این تیکت لغو شده است.')).toBeTruthy())
    expect(request).toHaveBeenLastCalledWith('/api/dashboard/support/ticket-1/close', expect.objectContaining({ method: 'POST' }))
  })
})
