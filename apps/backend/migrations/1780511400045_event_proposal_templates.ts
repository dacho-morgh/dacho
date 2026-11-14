import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- The owner's replacement for an event's sample proposal form. No row means the bundled default applies.
    CREATE TABLE IF NOT EXISTS dashboard.event_proposal_templates (
      event_id uuid PRIMARY KEY REFERENCES dashboard.events(id) ON DELETE CASCADE,
      storage_key text NOT NULL UNIQUE,
      filename text NOT NULL,
      mime_type text NOT NULL,
      size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10000000),
      policy_version text NOT NULL,
      updated_by text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.event_proposal_templates')
}
