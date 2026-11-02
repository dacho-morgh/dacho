import { OPERATIONAL_ROLE_LABELS, type OperationalRole } from '@cms-core/access/roles'

import type { LetterRecipient } from '@/components/dashboard/new-letter-form'
import type { LetterDto } from './dashboard-api'
import { serverDashboardFetchResult, type DashboardFetchResult } from './dashboard-server'

interface PermittedRecipient {
  id: string
  name: string | null
  operationalRole: OperationalRole
}

/** Who the actor may write to now, as the server resolves it. Sending re-checks every rule. */
export function permittedRecipients(
  query: { requestId?: string; search?: string } = {},
): Promise<DashboardFetchResult<{ items: PermittedRecipient[] }>> {
  const params = new URLSearchParams()
  if (query.requestId) params.set('requestId', query.requestId)
  if (query.search) params.set('search', query.search)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return serverDashboardFetchResult(`/letters/recipients${suffix}`)
}

export function recipientOption(recipient: PermittedRecipient): LetterRecipient {
  const role = OPERATIONAL_ROLE_LABELS[recipient.operationalRole]
  return { id: recipient.id, name: recipient.name ? `${recipient.name} — ${role}` : role }
}

/** The sender of a received letter, only when the actor may write back to them. */
export async function replyRecipient(letter: LetterDto, actorId: string): Promise<LetterRecipient | undefined> {
  if (!letter.senderId || letter.senderId === actorId) return undefined
  const result = await permittedRecipients(
    letter.requestId ? { requestId: letter.requestId } : { search: letter.senderName ?? undefined },
  )
  if (result.kind !== 'ok') return undefined
  const sender = result.data.items.find((item) => item.id === letter.senderId)
  return sender && recipientOption(sender)
}
