import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Booth requests are cases of their own (S7), not dashboard.requests rows, so a
    -- next-role notice may point at either one (S1 inbox).
    ALTER TABLE dashboard.notification_jobs
      ALTER COLUMN request_id DROP NOT NULL,
      ADD COLUMN booth_reservation_id uuid REFERENCES dashboard.booth_reservations(id) ON DELETE CASCADE,
      ADD CONSTRAINT notification_jobs_one_case CHECK ((request_id IS NULL) <> (booth_reservation_id IS NULL));
    CREATE INDEX notification_jobs_booth_idx ON dashboard.notification_jobs (booth_reservation_id)
      WHERE booth_reservation_id IS NOT NULL;
    -- The exhibition is kept with the letter so the inbox can link the step without a join.
    ALTER TABLE dashboard.letters
      ADD COLUMN booth_reservation_id uuid REFERENCES dashboard.booth_reservations(id) ON DELETE SET NULL,
      ADD COLUMN exhibition_id text;
    CREATE INDEX letters_pending_booth_step_idx
      ON dashboard.letters (booth_reservation_id, recipient_id)
      WHERE next_step IS NOT NULL AND next_step_done_at IS NULL;
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS dashboard.letters_pending_booth_step_idx;
    ALTER TABLE dashboard.letters
      DROP COLUMN IF EXISTS exhibition_id,
      DROP COLUMN IF EXISTS booth_reservation_id;
    DROP INDEX IF EXISTS dashboard.notification_jobs_booth_idx;
    DELETE FROM dashboard.notification_jobs WHERE request_id IS NULL;
    ALTER TABLE dashboard.notification_jobs
      DROP CONSTRAINT IF EXISTS notification_jobs_one_case,
      DROP COLUMN IF EXISTS booth_reservation_id,
      ALTER COLUMN request_id SET NOT NULL;
  `)
}
