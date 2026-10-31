import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Statement year of a financial statement file (year-indexed refs, T30). Other categories leave it empty.
    ALTER TABLE dashboard.private_documents
      ADD COLUMN statement_year integer CHECK (statement_year BETWEEN 1900 AND 2200);

    -- A frozen snapshot of the accepted financial files, taken when the company submits.
    -- The invitation holds one package per version; the files it names cannot change afterwards.
    CREATE TABLE dashboard.financial_packages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      invitation_id uuid NOT NULL REFERENCES dashboard.financial_invitations(id) ON DELETE CASCADE,
      package_version integer NOT NULL DEFAULT 1 CHECK (package_version > 0),
      checklist_version text NOT NULL CHECK (btrim(checklist_version) <> ''),
      statement_years integer[] NOT NULL,
      documents jsonb NOT NULL CHECK (jsonb_typeof(documents) = 'array' AND jsonb_array_length(documents) > 0),
      submitted_by text NOT NULL CHECK (btrim(submitted_by) <> ''),
      submitted_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (invitation_id, package_version)
    );

    CREATE INDEX financial_packages_request_idx ON dashboard.financial_packages (request_id);
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS dashboard.financial_packages;
    ALTER TABLE dashboard.private_documents DROP COLUMN IF EXISTS statement_year;
  `)
}
