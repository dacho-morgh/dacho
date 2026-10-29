import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE dashboard.requests ADD COLUMN IF NOT EXISTS submitted_by text;

    ALTER TABLE dashboard.request_rfps ADD COLUMN IF NOT EXISTS company_id text;

    ALTER TABLE dashboard.request_rfps DISABLE TRIGGER immutable_request_rfp;

    UPDATE dashboard.request_rfps rfp
    SET company_id = r.company_id
    FROM dashboard.requests r
    WHERE r.id = rfp.request_id AND rfp.company_id IS NULL;

    ALTER TABLE dashboard.request_rfps ENABLE TRIGGER immutable_request_rfp;

    CREATE UNIQUE INDEX IF NOT EXISTS request_rfps_company_subtopic_unique
      ON dashboard.request_rfps (company_id, event_id, subtopic_id)
      WHERE company_id IS NOT NULL;
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS dashboard.request_rfps_company_subtopic_unique;
    ALTER TABLE dashboard.request_rfps DROP COLUMN IF EXISTS company_id;
    ALTER TABLE dashboard.requests DROP COLUMN IF EXISTS submitted_by;
  `)
}
