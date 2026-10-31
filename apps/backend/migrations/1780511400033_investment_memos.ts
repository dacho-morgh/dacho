import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- The investment person's memo. Every save is a new version and no version's text
    -- changes afterwards, so the history of what was written and sent stays whole.
    CREATE TABLE dashboard.investment_memos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      package_id uuid NOT NULL REFERENCES dashboard.financial_packages(id) ON DELETE CASCADE,
      version integer NOT NULL CHECK (version > 0),
      body text NOT NULL CHECK (btrim(body) <> ''),
      author_id text NOT NULL CHECK (btrim(author_id) <> ''),
      created_at timestamptz NOT NULL DEFAULT now(),
      sent_at timestamptz,
      UNIQUE (request_id, version)
    );

    CREATE INDEX investment_memos_sent_idx ON dashboard.investment_memos (sent_at DESC) WHERE sent_at IS NOT NULL;
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS dashboard.investment_memos;
  `)
}
