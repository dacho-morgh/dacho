import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TYPE dashboard.company_verification_status AS ENUM (
    'pending', 'approved', 'returned', 'rejected'
  )`)

  pgm.sql(`CREATE TABLE dashboard.company_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id text NOT NULL,
    representative_id text NOT NULL,
    status dashboard.company_verification_status NOT NULL DEFAULT 'pending',
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    submitted_at timestamptz NOT NULL DEFAULT now(),
    decided_at timestamptz,
    reviewer_id text,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)

  pgm.sql('CREATE INDEX company_verifications_company_idx ON dashboard.company_verifications (company_id)')
  pgm.sql('CREATE INDEX company_verifications_status_idx ON dashboard.company_verifications (status)')
  pgm.sql('CREATE INDEX company_verifications_rep_idx ON dashboard.company_verifications (representative_id)')
  pgm.sql(`CREATE UNIQUE INDEX company_verifications_one_pending
    ON dashboard.company_verifications (company_id)
    WHERE status = 'pending'`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.company_verifications CASCADE')
  pgm.sql('DROP TYPE IF EXISTS dashboard.company_verification_status CASCADE')
}
