import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TYPE dashboard.booth_status AS ENUM ('available', 'unavailable')`)
  pgm.sql(`CREATE TYPE dashboard.price_unit AS ENUM ('toman')`)

  pgm.sql(`CREATE TABLE dashboard.exhibition_catalogue_settings (
    exhibition_id text PRIMARY KEY,
    company_booth_limit bigint NOT NULL CHECK (company_booth_limit > 0),
    guide_map_reference text,
    updated_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)

  pgm.sql(`CREATE TABLE dashboard.exhibition_booths (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exhibition_id text NOT NULL,
    identifier text NOT NULL,
    specification text NOT NULL,
    location text,
    status dashboard.booth_status NOT NULL DEFAULT 'available',
    active boolean NOT NULL DEFAULT true,
    price_amount bigint NOT NULL CHECK (price_amount > 0),
    price_unit dashboard.price_unit NOT NULL,
    price_version_id uuid,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)

  pgm.sql(`CREATE TABLE dashboard.booth_price_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booth_id uuid NOT NULL REFERENCES dashboard.exhibition_booths(id) ON DELETE RESTRICT,
    exhibition_id text NOT NULL,
    identifier text NOT NULL,
    price_amount bigint NOT NULL CHECK (price_amount > 0),
    price_unit dashboard.price_unit NOT NULL,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`)

  pgm.sql(`ALTER TABLE dashboard.exhibition_booths
    ADD CONSTRAINT exhibition_booths_price_version_fk
    FOREIGN KEY (price_version_id) REFERENCES dashboard.booth_price_versions(id) ON DELETE RESTRICT`)

  pgm.sql(`CREATE UNIQUE INDEX exhibition_booths_identifier_unique
    ON dashboard.exhibition_booths (exhibition_id, lower(identifier))`)
  pgm.sql(`CREATE INDEX exhibition_booths_exhibition_id_idx
    ON dashboard.exhibition_booths (exhibition_id)`)
  pgm.sql(`CREATE INDEX booth_price_versions_booth_id_idx
    ON dashboard.booth_price_versions (booth_id)`)
  pgm.sql(`CREATE INDEX booth_price_versions_exhibition_id_idx
    ON dashboard.booth_price_versions (exhibition_id)`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE dashboard.exhibition_booths
    DROP CONSTRAINT IF EXISTS exhibition_booths_price_version_fk`)
  pgm.sql('DROP TABLE IF EXISTS dashboard.booth_price_versions')
  pgm.sql('DROP TABLE IF EXISTS dashboard.exhibition_booths')
  pgm.sql('DROP TABLE IF EXISTS dashboard.exhibition_catalogue_settings')
  pgm.sql('DROP TYPE IF EXISTS dashboard.price_unit')
  pgm.sql('DROP TYPE IF EXISTS dashboard.booth_status')
}
