import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- What the Secretariat asked the company for. The letter is the message itself; the
    -- text stays here even if the recipient later deletes the letter from their mailbox.
    CREATE TABLE dashboard.supplementary_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      letter_id uuid REFERENCES dashboard.letters(id) ON DELETE SET NULL,
      body text NOT NULL CHECK (btrim(body) <> ''),
      requested_by text NOT NULL CHECK (btrim(requested_by) <> ''),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX supplementary_requests_request_idx ON dashboard.supplementary_requests (request_id, created_at DESC);

    -- A correspondence file the Secretariat opened to the investment person holding the case.
    CREATE TABLE dashboard.supplementary_deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      document_id uuid NOT NULL UNIQUE REFERENCES dashboard.private_documents(id) ON DELETE CASCADE,
      delivered_by text NOT NULL CHECK (btrim(delivered_by) <> ''),
      delivered_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX supplementary_deliveries_request_idx ON dashboard.supplementary_deliveries (request_id);

    -- The company-visible text, kept apart from the memo. Every save is a new version and
    -- no version's text changes afterwards. The company reads the latest published version.
    CREATE TABLE dashboard.published_results (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      version integer NOT NULL CHECK (version > 0),
      body text NOT NULL CHECK (btrim(body) <> ''),
      author_id text NOT NULL CHECK (btrim(author_id) <> ''),
      created_at timestamptz NOT NULL DEFAULT now(),
      source_memo_id uuid REFERENCES dashboard.investment_memos(id) ON DELETE SET NULL,
      published_by text,
      published_at timestamptz,
      UNIQUE (request_id, version),
      CHECK ((published_by IS NULL) = (published_at IS NULL))
    );
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS dashboard.published_results;
    DROP TABLE IF EXISTS dashboard.supplementary_deliveries;
    DROP TABLE IF EXISTS dashboard.supplementary_requests;
  `)
}
