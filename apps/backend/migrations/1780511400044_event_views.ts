import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Which events a user has opened. The sidebar counts the open events a company has not seen yet.
    CREATE TABLE IF NOT EXISTS dashboard.event_views (
      user_id text NOT NULL,
      event_id uuid NOT NULL,
      seen_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, event_id)
    );
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.event_views')
}
