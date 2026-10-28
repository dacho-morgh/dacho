import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TABLE dashboard.evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    role text NOT NULL,
    variant text NOT NULL CHECK (variant IN ('ordinary', 'employer')),
    state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'final')),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    scores jsonb NOT NULL DEFAULT '{}'::jsonb,
    score_a integer NOT NULL DEFAULT 0,
    score_b integer NOT NULL DEFAULT 0,
    score_c integer NOT NULL DEFAULT 0,
    weighted_hundredths integer NOT NULL DEFAULT 0,
    answers jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    finalized_at timestamptz,
    CONSTRAINT evaluations_request_user_revision_unique UNIQUE (request_id, user_id, revision)
  )`)

  pgm.sql('CREATE INDEX evaluations_request_state_idx ON dashboard.evaluations (request_id, state)')
  pgm.sql('CREATE INDEX evaluations_user_idx ON dashboard.evaluations (user_id)')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.evaluations')
}
