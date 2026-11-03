import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- An event's public page is a CMS events record the dashboard writes with it
    -- (S5, T60). Events made before this have none until the owner next saves them.
    ALTER TABLE dashboard.events ADD COLUMN public_event_id text;
    CREATE UNIQUE INDEX events_public_event_id_key
      ON dashboard.events (public_event_id) WHERE public_event_id IS NOT NULL;
    -- Exhibition edits from the dashboard are versioned, so a stale form gets 409.
    ALTER TABLE dashboard.exhibition_catalogue_settings
      ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE dashboard.exhibition_catalogue_settings DROP COLUMN IF EXISTS revision;
    DROP INDEX IF EXISTS dashboard.events_public_event_id_key;
    ALTER TABLE dashboard.events DROP COLUMN IF EXISTS public_event_id;
  `)
}
