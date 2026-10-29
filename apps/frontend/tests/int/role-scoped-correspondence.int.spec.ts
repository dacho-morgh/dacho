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

describe('FE22 - Role-scoped correspondence, support and private attachments', () => {
  describe('mapMailData', () => {
    it('maps real attachments, requestId and senderId without dropping them', () => {
      const dto: LetterDto = {
        id: 'letter-123',
        type: 'official',
        title: 'بررسی مدارک مالی تکمیلی',
        body: 'مدارک پیوست را بررسی فرمایید.',
        senderId: 'user-sec-1',
        senderName: 'دبیرخانه مرکزی',
        senderRole: 'دبیرخانه',
        recipientId: 'user-rep-1',
        requestId: 'req-456',
        read: false,
        sentAt: '2026-10-20T10:00:00Z',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
        attachments: [
          {
            id: 'doc-789',
            name: 'financial-statement.pdf',
            filename: 'financial-statement.pdf',
            size: '500 KB',
            sizeBytes: 512000,
            downloadUrl: '/api/dashboard/letters/letter-123/attachments/doc-789/download',
          },
        ],
      }

      const mail = mapMailData(dto)

      expect(mail.id).toBe('letter-123')
      expect(mail.senderId).toBe('user-sec-1')
      expect(mail.requestId).toBe('req-456')
      expect(mail.attachments).toHaveLength(1)
      expect(mail.attachments?.[0]).toEqual(
        expect.objectContaining({
          id: 'doc-789',
          name: 'financial-statement.pdf',
          size: '500 KB',
          downloadUrl: '/api/dashboard/letters/letter-123/attachments/doc-789/download',
        }),
      )
    })
  })

  describe('MailDetailView', () => {
    it('renders real attachments with download links', () => {
      const mail: MailData = {
        id: 'letter-10',
        title: 'نامه همراه با پیوست',
        category: 'نامه رسمی',
        senderName: 'دبیرخانه',
        senderRole: 'دبیرخانه',
        datePersian: '۱۴۰۵/۰۷/۲۹',
        dayOfWeek: 'سه‌شنبه',
        timeStr: '۱۰:۳۰',
        body: 'پیوست‌ها ضمیمه شده است.',
        attachments: [
          {
            id: 'doc-1',
            name: 'proposal.pdf',
            size: '250 KB',
            ext: 'pdf',
            downloadUrl: '/api/dashboard/letters/letter-10/attachments/doc-1/download',
          },
        ],
      }

      render(createElement(MailDetailView, { mail, showActions: true }))

      expect(screen.getByText('پیوست‌های نامه')).toBeTruthy()
      expect(screen.getByText('proposal.pdf')).toBeTruthy()
      expect(screen.getByText('(250 KB)')).toBeTruthy()

      const downloadLink = screen.getByRole('link', { name: 'دانلود' })
      expect(downloadLink.getAttribute('href')).toBe('/api/dashboard/letters/letter-10/attachments/doc-1/download')
    })

    it('renders thread history when thread messages are provided', () => {
      const mail: MailData = {
        id: 'letter-reply',
        title: 'پاسخ به استعلام',
        category: 'نامه رسمی',
        senderName: 'شرکت متقاضی',
        senderRole: 'نماینده شرکت',
        datePersian: '۱۴۰۵/۰۷/۲۹',
        dayOfWeek: 'سه‌شنبه',
        timeStr: '۱۴:۰۰',
        body: 'مدارک ارسال گردید.',
        thread: [
          {
            id: 'letter-parent',
            title: 'استعلام اولیه',
            senderName: 'دبیرخانه مرکزی',
            senderRole: 'دبیرخانه',
            datePersian: '۱۴۰۵/۰۷/۲۸',
            dayOfWeek: 'دوشنبه',
            timeStr: '۰۹:۰۰',
            body: 'لطفاً توضیحات تکمیلی را ارسال نمایید.',
          },
        ],
      }

      render(createElement(MailDetailView, { mail }))

      expect(screen.getByText('تاریخچه مکاتبات پرونده')).toBeTruthy()
      expect(screen.getByText('استعلام اولیه')).toBeTruthy()
      expect(screen.getByText('لطفاً توضیحات تکمیلی را ارسال نمایید.')).toBeTruthy()
      expect(screen.getByText('مدارک ارسال گردید.')).toBeTruthy()
    })
  })

  describe('NewLetterForm with case scope & attachments', () => {
    it('enables attachment upload when requestId is present and posts to /api/dashboard/letters', async () => {
      const request = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ letter: { id: 'letter-case-1' } }), { status: 201 }),
      )
      vi.stubGlobal('fetch', request)

      const recipients = [{ id: 'sec-1', name: 'دبیرخانه مرکزی' }]
      render(
        createElement(NewLetterForm, {
          companies: recipients,
          requestId: 'req-uuid-1234',
          caseTitle: 'درخواست عضویت شرکت نمونه',
        }),
      )

      expect(screen.getByText(/درخواست عضویت شرکت نمونه/)).toBeTruthy()

      const fileInput = screen.getByLabelText('فایل پیوست') as HTMLInputElement
      expect(fileInput.disabled).toBe(false)

      fireEvent.change(screen.getByLabelText('گیرنده'), { target: { value: 'sec-1' } })
      fireEvent.change(screen.getByLabelText('عنوان نامه'), { target: { value: 'ارسال مدارک پرونده' } })
      fireEvent.change(screen.getByLabelText('نوع نامه'), { target: { value: 'official' } })
      fireEvent.change(screen.getByLabelText('متن نامه'), { target: { value: 'توضیحات مربوط به پرونده' } })

      fireEvent.click(screen.getByRole('button', { name: 'ارسال نامه' }))

      await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard/letters'))
      expect(request).toHaveBeenCalledWith(
        '/api/dashboard/letters',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            recipientId: 'sec-1',
            title: 'ارسال مدارک پرونده',
            type: 'official',
            body: 'توضیحات مربوط به پرونده',
            requestId: 'req-uuid-1234',
          }),
        }),
      )
    })
  })

  describe('ApplicantLettersView inbox vs sent separation', () => {
    const letters: ApplicantLetterItem[] = [
      {
        id: 'incoming-1',
        title: 'نامه دریافتی از دبیرخانه',
        type: 'official',
        typeLabel: 'نامه رسمی',
        senderName: 'دبیرخانه مرکزی',
        senderRole: 'دبیرخانه',
        sentDate: '۱۴۰۵/۰۷/۲۵',
        source: 'letter',
        direction: 'received',
      },
      {
        id: 'outgoing-1',
        title: 'نامه ارسالی به دبیرخانه',
        type: 'official',
        typeLabel: 'نامه رسمی',
        senderName: 'دبیرخانه مرکزی',
        senderRole: 'گیرنده',
        sentDate: '۱۴۰۵/۰۷/۲۶',
        source: 'letter',
        direction: 'sent',
      },
    ]

    it('shows incoming letters in default tab and outgoing letters in sent tab', () => {
      render(createElement(ApplicantLettersView, { initialLetters: letters }))

      expect(screen.getAllByText('نامه دریافتی از دبیرخانه').length).toBeGreaterThan(0)
      expect(screen.queryAllByText('نامه ارسالی به دبیرخانه')).toHaveLength(0)

      fireEvent.click(screen.getByRole('button', { name: 'نامه‌های ارسالی' }))

      expect(screen.queryAllByText('نامه دریافتی از دبیرخانه')).toHaveLength(0)
      expect(screen.getAllByText('نامه ارسالی به دبیرخانه').length).toBeGreaterThan(0)
    })
  })
})
