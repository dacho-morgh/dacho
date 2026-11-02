import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  // 1. Add payment_status to dashboard.booth_reservations
  pgm.sql(`ALTER TABLE dashboard.booth_reservations
    ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid'`)

  pgm.sql(`ALTER TABLE dashboard.booth_reservations
    ADD CONSTRAINT booth_reservations_payment_status_check
    CHECK (payment_status IN ('unpaid', 'pending_verification', 'returned', 'confirmed', 'cancelled'))`)

  pgm.sql(`CREATE INDEX booth_reservations_payment_status_idx
    ON dashboard.booth_reservations (payment_status)`)

  // 2. Create dashboard.booth_payment_receipts
  pgm.sql(`CREATE TABLE dashboard.booth_payment_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id uuid NOT NULL REFERENCES dashboard.booth_reservations(id) ON DELETE CASCADE,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    tracking_code text,
    amount_toman bigint,
    paid_at timestamptz,
    description text,
    status text NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'returned', 'confirmed')),
    submitted_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT booth_payment_receipts_reservation_version_unique UNIQUE (reservation_id, version)
  )`)

  pgm.sql(`CREATE INDEX booth_payment_receipts_reservation_idx
    ON dashboard.booth_payment_receipts (reservation_id, version DESC)`)

  pgm.sql(`CREATE INDEX booth_payment_receipts_tracking_code_idx
    ON dashboard.booth_payment_receipts (tracking_code)
    WHERE tracking_code IS NOT NULL`)

  // 3. Create dashboard.booth_receipt_files
  pgm.sql(`CREATE TABLE dashboard.booth_receipt_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id uuid NOT NULL REFERENCES dashboard.booth_payment_receipts(id) ON DELETE CASCADE,
    reservation_id uuid NOT NULL REFERENCES dashboard.booth_reservations(id) ON DELETE CASCADE,
    storage_key text NOT NULL UNIQUE,
    filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10000000),
    file_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`)

  pgm.sql(`CREATE INDEX booth_receipt_files_receipt_idx
    ON dashboard.booth_receipt_files (receipt_id)`)

  pgm.sql(`CREATE INDEX booth_receipt_files_reservation_idx
    ON dashboard.booth_receipt_files (reservation_id)`)

  pgm.sql(`CREATE INDEX booth_receipt_files_file_hash_idx
    ON dashboard.booth_receipt_files (file_hash)`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.booth_receipt_files CASCADE')
  pgm.sql('DROP TABLE IF EXISTS dashboard.booth_payment_receipts CASCADE')
  pgm.sql('DROP INDEX IF EXISTS dashboard.booth_reservations_payment_status_idx')
  pgm.sql('ALTER TABLE dashboard.booth_reservations DROP CONSTRAINT IF EXISTS booth_reservations_payment_status_check')
  pgm.sql('ALTER TABLE dashboard.booth_reservations DROP COLUMN IF EXISTS payment_status')
}
