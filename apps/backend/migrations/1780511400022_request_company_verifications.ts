import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE dashboard.request_verifications (
      request_id uuid PRIMARY KEY REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      company_id text NOT NULL,
      verification_id uuid NOT NULL REFERENCES dashboard.company_verifications(id),
      revision integer NOT NULL CHECK (revision > 0),
      snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX request_verifications_company_idx ON dashboard.request_verifications (company_id);
    CREATE INDEX request_verifications_verification_idx ON dashboard.request_verifications (verification_id);

    CREATE OR REPLACE FUNCTION dashboard.reject_request_verification_update() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'Request verification snapshots are immutable';
    END $$;

    CREATE TRIGGER immutable_request_verification BEFORE UPDATE ON dashboard.request_verifications
      FOR EACH ROW EXECUTE FUNCTION dashboard.reject_request_verification_update();
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TRIGGER IF EXISTS immutable_request_verification ON dashboard.request_verifications;
    DROP FUNCTION IF EXISTS dashboard.reject_request_verification_update();
    DROP TABLE IF EXISTS dashboard.request_verifications;
  `)
}
