import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('ALTER TABLE dashboard.requests ADD COLUMN IF NOT EXISTS company_id text')
  pgm.sql('CREATE INDEX IF NOT EXISTS requests_company_id_idx ON dashboard.requests (company_id)')

  // Map only unambiguous representatives; duplicate links require manual reconciliation.
  // Explicitly reference public.companies since node-pg-migrate runs in the dashboard schema.
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'companies'
      ) THEN
        UPDATE dashboard.requests r
        SET company_id = c.id::text
        FROM (
          SELECT MIN(id) AS id, representative_id
          FROM public.companies
          GROUP BY representative_id
          HAVING COUNT(*) = 1
        ) c
        WHERE c.representative_id::text = r.owner_id
          AND r.company_id IS NULL;
      END IF;
    END $$;
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP INDEX IF EXISTS dashboard.requests_company_id_idx')
  pgm.sql('ALTER TABLE dashboard.requests DROP COLUMN IF EXISTS company_id')
}
