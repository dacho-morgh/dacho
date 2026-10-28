import { describe, expect, it, vi } from 'vitest'
import {
  PostgresNotificationOutbox,
  type NotificationJobDto,
  type NotificationOutbox,
} from '../src/dashboard/notification-outbox.js'

describe('Notification Outbox (Unit)', () => {
  it('enqueues and delivers notification job successfully', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'job-1',
            request_id: 'req-1',
            recipient_id: 'user-1',
            actor_id: 'user-1',
            action: 'submit',
            from_state: 'draft',
            to_state: 'in_review',
            revision: 2,
            channel: 'in_app',
            title: 'ارسال درخواست',
            body: 'درخواست با موفقیت ثبت شد',
            status: 'pending',
            attempts: 0,
            last_error: null,
            letter_id: null,
            created_at: new Date('2026-10-27T12:00:00Z'),
            updated_at: new Date('2026-10-27T12:00:00Z'),
            processed_at: null,
          },
        ],
      }),
    }

    const mockPool = {
      connect: vi.fn(),
      query: vi.fn(),
    }

    const outbox = new PostgresNotificationOutbox(mockPool as any)
    const job = await outbox.enqueue(mockClient as any, {
      requestId: 'req-1',
      recipientId: 'user-1',
      actorId: 'user-1',
      action: 'submit',
      fromState: 'draft',
      toState: 'in_review',
      revision: 2,
      title: 'ارسال درخواست',
      body: 'درخواست با موفقیت ثبت شد',
    })

    expect(job).toMatchObject({
      id: 'job-1',
      requestId: 'req-1',
      recipientId: 'user-1',
      action: 'submit',
      fromState: 'draft',
      toState: 'in_review',
      revision: 2,
      status: 'pending',
      attempts: 0,
    })
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO dashboard.notification_jobs'),
      expect.arrayContaining(['req-1', 'user-1', 'user-1', 'submit', 'draft', 'in_review', 2]),
    )
  })

  it('records delivery failure on notification job without throwing', async () => {
    const mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    }
    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    }

    // Step 1: select job FOR UPDATE
    mockClient.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            request_id: 'req-1',
            recipient_id: 'user-1',
            actor_id: 'user-1',
            action: 'submit',
            from_state: 'draft',
            to_state: 'in_review',
            revision: 2,
            channel: 'in_app',
            title: 'ارسال درخواست',
            body: 'درخواست با موفقیت ثبت شد',
            status: 'pending',
            attempts: 0,
            last_error: null,
            letter_id: null,
            created_at: new Date(),
            updated_at: new Date(),
            processed_at: null,
          },
        ],
      })
      // Step 2: insert into letters throws (delivery failure)
      .mockRejectedValueOnce(new Error('SMTP/Letter mailbox delivery failed'))
      // Step 3: update job to failed
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            status: 'failed',
            attempts: 1,
            last_error: 'SMTP/Letter mailbox delivery failed',
          },
        ],
      })

    const validJobId = 'a0000000-0000-0000-0000-000000000001'
    const outbox = new PostgresNotificationOutbox(mockPool as any)
    const result = await outbox.deliver(validJobId)

    expect(result.status).toBe('failed')
    expect(result.error).toContain('SMTP/Letter mailbox delivery failed')
    expect(mockClient.release).toHaveBeenCalled()
  })

  it('retrying already delivered job is a no-op that does not create a duplicate letter', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM dashboard.notification_jobs')) {
          return {
            rows: [
              {
                id: 'a0000000-0000-0000-0000-000000000001',
                request_id: 'req-1',
                recipient_id: 'user-1',
                status: 'delivered',
                letter_id: 'letter-existing-1',
                attempts: 1,
              },
            ],
          }
        }
        return { rows: [] }
      }),
      release: vi.fn(),
    }
    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
    }

    const validJobId = 'a0000000-0000-0000-0000-000000000001'
    const outbox = new PostgresNotificationOutbox(mockPool as any)
    const result = await outbox.retry(validJobId)

    expect(result).toEqual({
      jobId: validJobId,
      status: 'delivered',
      letterId: 'letter-existing-1',
      alreadyDelivered: true,
    })
    // No INSERT into letters should have occurred
    const insertLetterCall = mockClient.query.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO dashboard.letters'),
    )
    expect(insertLetterCall).toBeUndefined()
  })
})
