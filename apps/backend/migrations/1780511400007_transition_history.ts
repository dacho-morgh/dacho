import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('ALTER TABLE dashboard.requests ADD COLUMN revision integer NOT NULL DEFAULT 1')
  pgm.sql('ALTER TABLE dashboard.requests ADD CONSTRAINT requests_revision_positive CHECK (revision > 0)')

  pgm.sql(`ALTER TABLE dashboard.activities
    ADD COLUMN actor_id text,
    ADD COLUMN action text,
    ADD COLUMN reason text,
    ADD COLUMN from_state text,
    ADD COLUMN to_state text,
    ADD COLUMN revision integer`)

  pgm.sql(`ALTER TABLE dashboard.activities ADD CONSTRAINT activities_transition_complete CHECK (
    action IS NULL OR (
      actor_id IS NOT NULL AND from_state IS NOT NULL AND to_state IS NOT NULL AND revision IS NOT NULL
    )
  )`)

  pgm.sql('CREATE INDEX activities_request_id_idx ON dashboard.activities (request_id)')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP INDEX IF EXISTS dashboard.activities_request_id_idx')
  pgm.sql('ALTER TABLE dashboard.activities DROP CONSTRAINT IF EXISTS activities_transition_complete')
  pgm.sql(`ALTER TABLE dashboard.activities
    DROP COLUMN IF EXISTS revision,
    DROP COLUMN IF EXISTS to_state,
    DROP COLUMN IF EXISTS from_state,
    DROP COLUMN IF EXISTS reason,
    DROP COLUMN IF EXISTS action,
    DROP COLUMN IF EXISTS actor_id`)
  pgm.sql('ALTER TABLE dashboard.requests DROP CONSTRAINT IF EXISTS requests_revision_positive')
  pgm.sql('ALTER TABLE dashboard.requests DROP COLUMN IF EXISTS revision')
}
