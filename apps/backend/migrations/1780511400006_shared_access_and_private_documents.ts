import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TYPE dashboard.case_assignment_role AS ENUM (
    'chief-reviewer', 'reviewer', 'employer-reviewer', 'investment-reviewer'
  )`)

  pgm.sql(`CREATE TABLE dashboard.case_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    role dashboard.case_assignment_role NOT NULL,
    active boolean NOT NULL DEFAULT true,
    assigned_by text NOT NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    revoked_by text,
    revoked_at timestamptz,
    revoke_reason text
  )`)

  // Only one active assignment per (request, person, role). Historical rows are
  // retained as inactive evidence rather than deleted.
  pgm.sql(`CREATE UNIQUE INDEX case_assignments_active_unique
    ON dashboard.case_assignments (request_id, user_id, role)
    WHERE active`)
  pgm.sql('CREATE INDEX case_assignments_user_active_idx ON dashboard.case_assignments (user_id, role, active)')
  pgm.sql('CREATE INDEX case_assignments_request_idx ON dashboard.case_assignments (request_id)')

  pgm.sql(`CREATE TABLE dashboard.private_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key text NOT NULL UNIQUE,
    category text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10000000),
    logical_version integer NOT NULL DEFAULT 1 CHECK (logical_version > 0),
    request_id uuid REFERENCES dashboard.requests(id) ON DELETE CASCADE,
    company_id text,
    uploader_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (request_id IS NOT NULL OR company_id IS NOT NULL)
  )`)

  pgm.sql('CREATE INDEX private_documents_request_idx ON dashboard.private_documents (request_id, category, logical_version)')
  pgm.sql('CREATE INDEX private_documents_company_idx ON dashboard.private_documents (company_id)')
  pgm.sql('CREATE INDEX private_documents_uploader_idx ON dashboard.private_documents (uploader_id)')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.private_documents')
  pgm.sql('DROP TABLE IF EXISTS dashboard.case_assignments')
  pgm.sql('DROP TYPE IF EXISTS dashboard.case_assignment_role')
}
