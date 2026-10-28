import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE dashboard.exhibition_booths
    ADD CONSTRAINT exhibition_booths_id_exhibition_unique UNIQUE (id, exhibition_id)`)
  pgm.sql(`CREATE TABLE dashboard.booth_reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exhibition_id text NOT NULL,
    booth_id uuid NOT NULL,
    company_id text NOT NULL,
    requested_by text NOT NULL,
    price_version_id uuid NOT NULL REFERENCES dashboard.booth_price_versions(id) ON DELETE RESTRICT,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (booth_id, exhibition_id) REFERENCES dashboard.exhibition_booths(id, exhibition_id) ON DELETE RESTRICT
  )`)
  pgm.sql(`CREATE UNIQUE INDEX booth_reservations_one_active_booth
    ON dashboard.booth_reservations (booth_id) WHERE active`)
  pgm.sql(`CREATE INDEX booth_reservations_company_exhibition_active
    ON dashboard.booth_reservations (exhibition_id, company_id) WHERE active`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.booth_reservations')
  pgm.sql('ALTER TABLE dashboard.exhibition_booths DROP CONSTRAINT IF EXISTS exhibition_booths_id_exhibition_unique')
}
