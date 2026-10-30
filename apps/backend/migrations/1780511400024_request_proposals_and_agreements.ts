import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE dashboard.request_agreements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      revision integer NOT NULL CHECK (revision > 0),
      agreement_type text NOT NULL CHECK (agreement_type IN ('non_compete', 'event_rules')),
      text_version_id text NOT NULL CHECK (btrim(text_version_id) <> ''),
      accepted_by text NOT NULL,
      accepted_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (request_id, revision, agreement_type)
    );

    CREATE INDEX request_agreements_request_idx ON dashboard.request_agreements (request_id);

    CREATE TABLE dashboard.request_proposals (
      request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      revision integer NOT NULL CHECK (revision > 0),
      form_version text NOT NULL CHECK (btrim(form_version) <> ''),
      application_team jsonb NOT NULL DEFAULT '[]'::jsonb,
      proposal_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (request_id, revision)
    );

    CREATE INDEX request_proposals_request_idx ON dashboard.request_proposals (request_id);

    CREATE OR REPLACE FUNCTION dashboard.reject_request_agreement_update() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'Request agreement records are immutable';
    END $$;

    CREATE TRIGGER immutable_request_agreement BEFORE UPDATE ON dashboard.request_agreements
      FOR EACH ROW EXECUTE FUNCTION dashboard.reject_request_agreement_update();

    CREATE OR REPLACE FUNCTION dashboard.reject_request_proposal_update() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'Request proposal records are immutable';
    END $$;

    CREATE TRIGGER immutable_request_proposal BEFORE UPDATE ON dashboard.request_proposals
      FOR EACH ROW EXECUTE FUNCTION dashboard.reject_request_proposal_update();
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TRIGGER IF EXISTS immutable_request_proposal ON dashboard.request_proposals;
    DROP FUNCTION IF EXISTS dashboard.reject_request_proposal_update();
    DROP TABLE IF EXISTS dashboard.request_proposals;

    DROP TRIGGER IF EXISTS immutable_request_agreement ON dashboard.request_agreements;
    DROP FUNCTION IF EXISTS dashboard.reject_request_agreement_update();
    DROP TABLE IF EXISTS dashboard.request_agreements;
  `)
}
