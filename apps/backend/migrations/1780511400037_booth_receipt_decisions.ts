import type { MigrationBuilder } from 'node-pg-migrate'

// T51 (S7): Secretariat confirms a booth receipt or returns it with a reason.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE dashboard.booth_payment_receipts
    ADD COLUMN decision_reason text,
    ADD COLUMN decided_by text,
    ADD COLUMN decided_at timestamptz`)

  pgm.sql(`ALTER TABLE dashboard.booth_payment_receipts
    ADD CONSTRAINT booth_payment_receipts_returned_reason
    CHECK (status <> 'returned' OR (decision_reason IS NOT NULL AND length(trim(decision_reason)) > 0))`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('ALTER TABLE dashboard.booth_payment_receipts DROP CONSTRAINT IF EXISTS booth_payment_receipts_returned_reason')
  pgm.sql(`ALTER TABLE dashboard.booth_payment_receipts
    DROP COLUMN IF EXISTS decided_at,
    DROP COLUMN IF EXISTS decided_by,
    DROP COLUMN IF EXISTS decision_reason`)
}
