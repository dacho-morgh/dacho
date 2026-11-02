// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MailDetailView, type MailData } from '@/components/dashboard/mail-detail-view'
import { NewLetterForm } from '@/components/dashboard/new-letter-form'
import { ApplicantLettersView, type ApplicantLetterItem } from '@/components/dashboard/applicant-letters-view'
import { mapMailData, type LetterDto } from '@/utilities/dashboard-api'

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const baseMail: MailData = {
  id: 'letter-10',
  title: 'نامه همراه با پیوست',
  category: 'نامه رسمی',
  senderName: 'دبیرخانه',
  senderRole: 'دبیرخانه',
  datePersian: '۱۴۰۵/۰۷/۲۹',
  dayOfWeek: 'سه‌شنبه',
  timeStr: '۱۰:۳۰',
  body: 'متن نامه',
}

describe('FE22 - role-scoped correspondence', () => {
  it('maps real attachments and shows the sender role in Persian', () => {
    const dto: LetterDto = {
      id: 'letter-123',
      type: 'official',
      title: 'بررسی مدارک',
      body: 'متن',
      senderId: 'user-sec-1',
      senderName: 'دبیرخانه مرکزی',
      senderRole: 'central-secretariat',
      recipientId: 'user-rep-1',
      requestId: 'req-456',
      read: false,
      sentAt: '2026-10-20T10:00:00Z',
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-20T10:00:00Z',
      attachments: [{ id: 'doc-789', filename: 'statement.pdf', sizeBytes: 512000 }],
    }
    const mail = mapMailData(dto)
    expect(mail.senderRole).toBe('دبیرخانه مرکزی')
    expect(mail.attachments).toEqual([expect.objectContaining({ id: 'doc-789', name: 'statement.pdf' })])
  })

  describe('MailDetailView', () => {
    it('offers a reply only when the page was given a permitted one', () => {
      const { rerender } = render(createElement(MailDetailView, { mail: baseMail, showActions: true }))
      expect(screen.queryByText('ثبت بازخورد')).toBeNull()
      rerender(createElement(MailDetailView, { mail: baseMail, showActions: true, replyHref: '/dashboard/letters/new?replyTo=letter-10' }))
      expect(screen.getByRole('link', { name: 'ثبت بازخورد' }).getAttribute('href')).toBe('/dashboard/letters/new?replyTo=letter-10')
    })

    it('does not let a sender delete their copy', () => {
      render(createElement(MailDetailView, { mail: baseMail, showActions: true, canDelete: false }))
      expect(screen.queryByRole('button', { name: 'عملیات بیشتر' })).toBeNull()
    })

    it('renders the case history with its attachments, or says it is unavailable', () => {
      const thread: MailData[] = [{
        ...baseMail,
        id: 'letter-parent',
        title: 'استعلام اولیه',
        body: 'توضیحات تکمیلی',
        attachments: [{ id: 'doc-2', name: 'older.pdf', size: '۱ مگابایت' }],
      }]
      const { rerender } = render(createElement(MailDetailView, { mail: { ...baseMail, thread } }))
      expect(screen.getByText('تاریخچه مکاتبات پرونده')).toBeTruthy()
      expect(screen.getByText('استعلام اولیه')).toBeTruthy()
      expect(screen.getByText('older.pdf')).toBeTruthy()

      rerender(createElement(MailDetailView, { mail: { ...baseMail, threadNotice: 'دریافت تاریخچه انجام نشد.' } }))
      expect(screen.getByRole('status').textContent).toBe('دریافت تاریخچه انجام نشد.')
    })
  })

  describe('NewLetterForm', () => {
    const recipients = [{ id: 'sec-1', name: 'دبیرخانه مرکزی' }]

    function fill() {
      fireEvent.change(screen.getByLabelText('عنوان نامه'), { target: { value: 'ارسال مدارک' } })
      fireEvent.change(screen.getByLabelText('متن نامه'), { target: { value: 'توضیحات' } })
    }

    it('keeps a fixed case, preselects the reply recipient and sends through the letters API', async () => {
      const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ letter: { id: 'letter-1' } }), { status: 201 }))
      vi.stubGlobal('fetch', request)
      render(createElement(NewLetterForm, {
        mode: 'letter',
        companies: recipients,
        requestId: 'req-1',
        caseTitle: 'درخواست نمونه',
        officialOnly: true,
        initialRecipientId: 'sec-1',
        initialTitle: 'پاسخ به: استعلام',
      }))
      expect((screen.getByLabelText('پرونده مرتبط') as HTMLInputElement).value).toBe('درخواست نمونه')
      expect((screen.getByLabelText('عنوان نامه') as HTMLInputElement).value).toBe('پاسخ به: استعلام')
      fill()
      fireEvent.click(screen.getByRole('button', { name: 'ارسال نامه' }))
      await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard/letters'))
      const [url, init] = request.mock.calls[0]!
      expect(url).toBe('/api/dashboard/letters')
      expect(JSON.parse(init.body)).toMatchObject({ recipientId: 'sec-1', requestId: 'req-1', type: 'official' })
    })

    it('retries one letter with one key and gives an edited letter a new key', async () => {
      const request = vi.fn().mockRejectedValue(new TypeError('network'))
      vi.stubGlobal('fetch', request)
      render(createElement(NewLetterForm, {
        mode: 'letter', companies: recipients, officialOnly: true, initialRecipientId: 'sec-1',
      }))
      fill()
      const send = () => fireEvent.click(screen.getByRole('button', { name: 'ارسال نامه' }))
      const keyOf = (call: number) => JSON.parse(request.mock.calls[call]![1].body).idempotencyKey
      send()
      await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
      await screen.findByRole('alert')
      send()
      await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
      await waitFor(() => expect((screen.getByRole('button', { name: 'ارسال نامه' }) as HTMLButtonElement).disabled).toBe(false))
      expect(keyOf(0)).toBeTruthy()
      expect(keyOf(1)).toBe(keyOf(0))
      fireEvent.change(screen.getByLabelText('متن نامه'), { target: { value: 'متن تازه' } })
      send()
      await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
      expect(keyOf(2)).not.toBe(keyOf(0))
    })

    it('asks staff without a general recipient to choose a case, and navigates to it', () => {
      render(createElement(NewLetterForm, {
        mode: 'letter',
        companies: [],
        officialOnly: true,
        caseOptions: [{ id: 'req-2', trackingCode: 'T-2', title: 'پرونده دو' }],
      }))
      expect(screen.getByText('برای نوشتن نامه، ابتدا پرونده مرتبط را انتخاب کنید.')).toBeTruthy()
      fireEvent.change(screen.getByLabelText('پرونده مرتبط (اختیاری)'), { target: { value: 'req-2' } })
      expect(navigation.push).toHaveBeenCalledWith('/dashboard/letters/new?requestId=req-2')
    })
  })

  describe('ApplicantLettersView', () => {
    const letters: ApplicantLetterItem[] = [
      { id: 'incoming-1', title: 'نامه دریافتی', type: 'official', typeLabel: 'نامه رسمی', senderName: 'دبیرخانه', senderRole: 'دبیرخانه', sentDate: '۱۴۰۵/۰۷/۲۵', source: 'letter', direction: 'received', read: false },
      { id: 'outgoing-1', title: 'نامه ارسالی', type: 'official', typeLabel: 'نامه رسمی', senderName: 'دبیرخانه', senderRole: 'گیرنده', sentDate: '۱۴۰۵/۰۷/۲۶', source: 'letter', direction: 'sent' },
    ]

    it('separates inbox from sent and marks unread letters', () => {
      render(createElement(ApplicantLettersView, { initialLetters: letters }))
      expect(screen.getAllByText('نامه دریافتی').length).toBeGreaterThan(0)
      expect(screen.getAllByText('خوانده‌نشده').length).toBeGreaterThan(0)
      expect(screen.queryAllByText('نامه ارسالی')).toHaveLength(0)

      fireEvent.click(screen.getByRole('button', { name: 'نامه‌های ارسالی' }))
      expect(screen.queryAllByText('نامه دریافتی')).toHaveLength(0)
      expect(screen.getAllByText('نامه ارسالی').length).toBeGreaterThan(0)
      expect(screen.queryAllByText('خوانده‌نشده')).toHaveLength(0)
    })

    it('offers the letter composer only to staff', () => {
      const { rerender } = render(createElement(ApplicantLettersView, { initialLetters: [] }))
      expect(screen.queryByRole('link', { name: 'نامه جدید' })).toBeNull()
      rerender(createElement(ApplicantLettersView, { initialLetters: [], canComposeLetter: true }))
      expect(screen.getByRole('link', { name: 'نامه جدید' }).getAttribute('href')).toBe('/dashboard/letters/new')
    })
  })
})
