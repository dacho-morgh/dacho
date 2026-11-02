import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Deleting a displayed letter hides it from the mailbox; the row stays as case history.
    ALTER TABLE dashboard.letters
      ADD COLUMN mailbox_hidden_at timestamptz,
      ADD COLUMN idempotency_key uuid;
    CREATE UNIQUE INDEX letters_sender_idempotency_key_idx
      ON dashboard.letters (sender_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS dashboard.letters_sender_idempotency_key_idx;
    ALTER TABLE dashboard.letters
      DROP COLUMN IF EXISTS idempotency_key,
      DROP COLUMN IF EXISTS mailbox_hidden_at;
  `)
}
