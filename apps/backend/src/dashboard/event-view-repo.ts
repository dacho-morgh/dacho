import type { Pool } from 'pg'

import { isEventId } from './event-repo.js'

/** Which events a user has opened, for the «new» count in the sidebar. */
export class EventViewRepository {
  constructor(private readonly pool: Pool) {}

  async markSeen(userId: string, eventId: string): Promise<void> {
    if (!isEventId(eventId)) return
    await this.pool.query(
      `INSERT INTO dashboard.event_views (user_id, event_id) VALUES ($1, $2)
       ON CONFLICT (user_id, event_id) DO NOTHING`,
      [userId, eventId],
    )
  }

  /** How many of these events the user has not opened. */
  async countUnseen(userId: string, eventIds: string[]): Promise<number> {
    const ids = eventIds.filter(isEventId)
    if (ids.length === 0) return 0
    const { rows } = await this.pool.query<{ seen: string }>(
      'SELECT COUNT(*) AS seen FROM dashboard.event_views WHERE user_id = $1 AND event_id = ANY($2::uuid[])',
      [userId, ids],
    )
    return ids.length - Number(rows[0]?.seen ?? 0)
  }
}
