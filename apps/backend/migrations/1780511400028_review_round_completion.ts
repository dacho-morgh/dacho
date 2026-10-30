import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Set once the four active slots of a round hold final evaluations for its
    -- revision. It is readiness for the chief's decision and moves nothing.
    ALTER TABLE dashboard.review_rounds ADD COLUMN completed_at timestamptz;

    -- A round that already reached 4/4 has no write left that could complete it:
    -- its four evaluations are locked.
    UPDATE dashboard.review_rounds rr
    SET completed_at = done.last_finalized_at
    FROM (
      SELECT a.round_id, max(ev.finalized_at) AS last_finalized_at
      FROM dashboard.case_assignments a
      JOIN dashboard.review_rounds bound ON bound.id = a.round_id
      JOIN dashboard.evaluations ev
        ON ev.request_id = a.request_id AND ev.user_id = a.user_id AND ev.role = a.role::text
       AND ev.revision = bound.request_revision AND ev.state = 'final'
      WHERE a.active
      GROUP BY a.round_id
      HAVING count(*) = 4
    ) done
    WHERE rr.id = done.round_id;
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE dashboard.review_rounds DROP COLUMN IF EXISTS completed_at;
  `)
}
