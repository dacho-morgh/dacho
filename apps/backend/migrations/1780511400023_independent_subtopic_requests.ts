import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE dashboard.requests ADD COLUMN IF NOT EXISTS submitted_by text;

    ALTER TABLE dashboard.request_rfps ADD COLUMN IF NOT EXISTS company_id text;

    ALTER TABLE dashboard.request_rfps DISABLE TRIGGER immutable_request_rfp;

    -- This column reserves uniqueness, not ownership (requests.company_id).
    -- Grandfather legacy duplicates without deleting or reassigning any case.
    -- One deterministic reservation per group blocks all new duplicates.
    WITH reservations AS (
      SELECT rfp.request_id, r.company_id,
             row_number() OVER (
               PARTITION BY r.company_id, rfp.event_id, rfp.subtopic_id
               ORDER BY rfp.request_id
             ) AS position
      FROM dashboard.request_rfps rfp
      JOIN dashboard.requests r ON r.id = rfp.request_id
      WHERE r.company_id IS NOT NULL
    )
    UPDATE dashboard.request_rfps rfp
    SET company_id = CASE WHEN reservations.position = 1 THEN reservations.company_id ELSE NULL END
    FROM reservations
    WHERE rfp.request_id = reservations.request_id;

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
