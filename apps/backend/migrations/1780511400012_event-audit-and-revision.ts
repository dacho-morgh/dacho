import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE dashboard.events
    ADD COLUMN revision integer NOT NULL DEFAULT 1,
    ADD CONSTRAINT events_revision_positive CHECK (revision > 0)`)

  pgm.sql(`CREATE TABLE dashboard.event_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES dashboard.events(id) ON DELETE CASCADE,
    revision integer NOT NULL CHECK (revision > 0),
    actor_id text NOT NULL CHECK (btrim(actor_id) <> ''),
    reason text NOT NULL CHECK (btrim(reason) <> ''),
    changed_fields text[] NOT NULL,
    before_state jsonb NOT NULL,
    after_state jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (event_id, revision)
  )`)

  pgm.sql('CREATE INDEX event_audit_event_idx ON dashboard.event_audit (event_id, created_at DESC)')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.event_audit')
  pgm.sql(`ALTER TABLE dashboard.events
    DROP CONSTRAINT IF EXISTS events_revision_positive,
    DROP COLUMN IF EXISTS revision`)
}
