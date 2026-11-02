import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- What the recipient of a case notification is expected to do next (S1 inbox).
    -- A step stays pending until that person acts or the case moves past it.
    ALTER TABLE dashboard.notification_jobs
      ADD COLUMN next_step text;
    ALTER TABLE dashboard.letters
      ADD COLUMN next_step text,
      ADD COLUMN next_step_done_at timestamptz;
    CREATE INDEX letters_pending_next_step_idx
      ON dashboard.letters (request_id, recipient_id)
      WHERE next_step IS NOT NULL AND next_step_done_at IS NULL;
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS dashboard.letters_pending_next_step_idx;
    ALTER TABLE dashboard.letters
      DROP COLUMN IF EXISTS next_step_done_at,
      DROP COLUMN IF EXISTS next_step;
    ALTER TABLE dashboard.notification_jobs
      DROP COLUMN IF EXISTS next_step;
  `)
}
