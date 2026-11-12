import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Files the company attached when it opened the ticket. Each entry is a
    -- snapshot of a private document the company uploaded (category
    -- supportAttachment); the bytes are only served by the ticket-scoped route.
    ALTER TABLE dashboard.support_tickets
      ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('ALTER TABLE dashboard.support_tickets DROP COLUMN IF EXISTS attachments')
}
