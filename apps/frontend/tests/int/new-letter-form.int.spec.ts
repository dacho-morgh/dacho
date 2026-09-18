// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewLetterForm } from '@/components/dashboard/new-letter-form'

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const companies = [{ id: 'company-1', companyName: 'شرکت نمونه' }]

function fillLetter() {
  fireEvent.change(screen.getByLabelText('گیرنده'), { target: { value: 'company-1' } })
  fireEvent.change(screen.getByLabelText('عنوان نامه'), { target: { value: 'عنوان' } })
  fireEvent.change(screen.getByLabelText('نوع نامه'), { target: { value: 'official' } })
  fireEvent.change(screen.getByLabelText('متن نامه'), { target: { value: 'متن' } })
}

describe('NewLetterForm', () => {
  it('cancels without sending', () => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    render(createElement(NewLetterForm, { companies }))
    fireEvent.click(screen.getByRole('button', { name: 'لغو' }))
    expect(navigation.push).toHaveBeenCalledWith('/dashboard/letters')
    expect(request).not.toHaveBeenCalled()
  })

  it('retains the draft and allows retry after a failed request', async () => {
    const request = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', request)
    render(createElement(NewLetterForm, { companies }))
    fillLetter()
    fireEvent.click(screen.getByRole('button', { name: 'ارسال نامه' }))
    await screen.findByRole('alert')
    expect((screen.getByLabelText('متن نامه') as HTMLTextAreaElement).value).toBe('متن')
    expect(navigation.push).not.toHaveBeenCalled()
    request.mockResolvedValueOnce(new Response(JSON.stringify({ letter: { id: 'saved' } })))
    fireEvent.click(screen.getByRole('button', { name: 'ارسال نامه' }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalled())
  })

  it('rejects whitespace-only text without sending', () => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    render(createElement(NewLetterForm, { companies }))
    fillLetter()
    fireEvent.change(screen.getByLabelText('عنوان نامه'), { target: { value: '   ' } })
    fireEvent.submit(screen.getByRole('form', { name: 'ارسال نامه جدید' }))
    expect(screen.getByRole('alert').textContent).toContain('تکمیل')
    expect(request).not.toHaveBeenCalled()
  })

  it('blocks duplicate submissions while sending', async () => {
    let finish!: (response: Response) => void
    const request = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve }))
    vi.stubGlobal('fetch', request)
    render(createElement(NewLetterForm, { companies }))
    fillLetter()
    const form = screen.getByRole('form', { name: 'ارسال نامه جدید' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(request).toHaveBeenCalledTimes(1)
    finish(new Response(JSON.stringify({ letter: { id: 'saved' } })))
    await waitFor(() => expect(navigation.push).toHaveBeenCalled())
  })

  it('makes missing recipients and unsupported attachments explicit', () => {
    render(createElement(NewLetterForm, { companies: [], recipientsError: true }))
    expect(screen.getByRole('alert').textContent).toContain('دریافت گیرندگان انجام نشد')
    expect((screen.getByRole('button', { name: 'ارسال نامه' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('فایل پیوست') as HTMLInputElement).disabled).toBe(true)
  })
  it('sends the selected recipient and type with trimmed text, then returns to letters', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ letter: { id: 'letter-1' } })))
    vi.stubGlobal('fetch', request)
    render(createElement(NewLetterForm, { companies }))

    fireEvent.change(screen.getByLabelText('گیرنده'), { target: { value: 'company-1' } })
    fireEvent.change(screen.getByLabelText('عنوان نامه'), { target: { value: ' عنوان تست ' } })
    fireEvent.change(screen.getByLabelText('نوع نامه'), { target: { value: 'notification' } })
    fireEvent.change(screen.getByLabelText('متن نامه'), { target: { value: ' متن تست ' } })
    fireEvent.click(screen.getByRole('button', { name: 'ارسال نامه' }))

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard/letters'))
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('/api/dashboard/admin/letters', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipientId: 'company-1', title: 'عنوان تست', type: 'notification', body: 'متن تست' }),
    }))
    expect(navigation.refresh).toHaveBeenCalledTimes(1)
  })

  describe('support mode (for applicant / پیام به پشتیبانی)', () => {
    it('renders support fields: fixed recipient, support subject label, and میزان اهمیت', () => {
      render(createElement(NewLetterForm, { mode: 'support' }))
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('پشتیبانی')
      expect((screen.getByLabelText('گیرنده') as HTMLInputElement).disabled).toBe(true)
      expect(screen.getByLabelText('موضوع پیام پشتیبانی')).toBeTruthy()
      expect(screen.getByLabelText('میزان اهمیت')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'ارسال پیام' })).toBeTruthy()
    })

    it('submits support message with priority and subject to /api/dashboard/support', async () => {
      const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ticket: { id: 'ticket-1' } })))
      vi.stubGlobal('fetch', request)
      render(createElement(NewLetterForm, { mode: 'support' }))

      fireEvent.change(screen.getByLabelText('موضوع پیام پشتیبانی'), { target: { value: ' مشکل در ورود ' } })
      fireEvent.change(screen.getByLabelText('میزان اهمیت'), { target: { value: 'urgent' } })
      fireEvent.change(screen.getByLabelText('متن پیام'), { target: { value: ' شرح مشکل در بخش لاگین ' } })
      fireEvent.click(screen.getByRole('button', { name: 'ارسال پیام' }))

      await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard/letters'))
      expect(request).toHaveBeenCalledTimes(1)
      expect(request).toHaveBeenCalledWith('/api/dashboard/support', expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: '[اولویت: فوری] مشکل در ورود',
          message: 'شرح مشکل در بخش لاگین',
        }),
      }))
    })
  })
})

