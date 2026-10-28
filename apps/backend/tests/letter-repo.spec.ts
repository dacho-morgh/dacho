import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { LetterRepository } from '../src/dashboard/letter-repo.js'

const id = '00000000-0000-4000-8000-000000000001'
const row = {
  id, type: 'official', title: 'Letter', body: 'Body', sender_id: 'sender',
  sender_name: 'Sender', sender_role: 'chief-reviewer', recipient_id: 'recipient',
  request_id: null, read: false, sent_at: new Date(), attachments: [],
  created_at: new Date(), updated_at: new Date(),
}

describe('scoped letter reads', () => {
  it.each(['sender', 'overseer'])('does not mark the recipient mailbox read for %s', async (actorId) => {
    const query = vi.fn().mockResolvedValue({ rows: [row] })
    const repo = new LetterRepository({ query } as unknown as Pool)
    const result = await repo.findByIdAndMarkReadScoped(id, { kind: 'all' }, actorId)
    expect(result?.read).toBe(false)
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('marks the letter read for its recipient while retaining recipient scope', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [{ ...row, read: true }] })
    const repo = new LetterRepository({ query } as unknown as Pool)
    const result = await repo.findByIdAndMarkReadScoped(id, { kind: 'owner', userId: 'recipient' }, 'recipient')
    expect(result?.read).toBe(true)
    expect(query.mock.calls[1]?.[0]).toContain('l.recipient_id = $2')
    expect(query.mock.calls[1]?.[1]).toEqual([id, 'recipient', 'recipient'])
  })

  it('does not update an unreadable letter', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] })
    const repo = new LetterRepository({ query } as unknown as Pool)
    expect(await repo.findByIdAndMarkReadScoped(id, { kind: 'none' }, 'recipient')).toBeUndefined()
    expect(query).toHaveBeenCalledTimes(1)
  })
})

describe('atomic case-letter creation', () => {
  it('does not acknowledge a letter when the write-time scope rejects it', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] })
    const repo = new LetterRepository({ query } as unknown as Pool)
    const fallback = vi.spyOn(repo, 'create')
    const result = await repo.createScoped({ type: 'official', title: 'Letter', body: 'Body', senderId: 'sender', recipientId: 'recipient', requestId: id },
      { kind: 'assigned', userId: 'sender', role: 'reviewer' },
      { kind: 'assigned', userId: 'recipient', role: 'chief-reviewer' }, true)
    expect(result).toBeUndefined()
    expect(fallback).not.toHaveBeenCalled()
    expect(query).toHaveBeenCalledTimes(1)
    const [sql, params] = query.mock.calls[0]!
    expect(sql).toContain('FOR SHARE')
    expect(sql).toContain('INSERT INTO dashboard.letters')
    expect(sql).toContain("COUNT(*) FROM locked_letter_assignments WHERE role = 'chief-reviewer'")
    expect(params.slice(-4)).toEqual(['sender', 'reviewer', 'recipient', 'chief-reviewer'])
  })
})
