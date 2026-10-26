import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TABLE dashboard.events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL CHECK (btrim(title) <> ''),
    description text NOT NULL DEFAULT '',
    registration_open_at timestamptz NOT NULL,
    registration_close_at timestamptz NOT NULL,
    responsible_chief_id text NOT NULL CHECK (btrim(responsible_chief_id) <> ''),
    responsible_investment_id text NOT NULL CHECK (btrim(responsible_investment_id) <> ''),
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (registration_close_at > registration_open_at),
    CHECK (responsible_chief_id <> responsible_investment_id)
  )`)

  // Event responsibility is scoped per event; these indexes keep later
  // subtopic and assignment checks from scanning every configured event.
  pgm.sql('CREATE INDEX events_registration_window_idx ON dashboard.events (registration_open_at, registration_close_at)')
  pgm.sql('CREATE INDEX events_responsible_chief_idx ON dashboard.events (responsible_chief_id)')
  pgm.sql('CREATE INDEX events_responsible_investment_idx ON dashboard.events (responsible_investment_id)')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.events')
}
