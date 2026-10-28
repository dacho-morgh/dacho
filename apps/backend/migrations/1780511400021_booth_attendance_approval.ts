import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE dashboard.booth_reservations
    ADD COLUMN attendance_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN attendance_reason text,
    ADD COLUMN attendance_decided_by text,
    ADD COLUMN attendance_decided_at timestamptz`)

  pgm.sql(`ALTER TABLE dashboard.booth_reservations
    ADD CONSTRAINT booth_reservations_attendance_status_check
    CHECK (attendance_status IN ('pending', 'approved', 'rejected'))`)

  pgm.sql(`CREATE TABLE dashboard.booth_attendance_decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id uuid NOT NULL REFERENCES dashboard.booth_reservations(id) ON DELETE CASCADE,
    action text NOT NULL CHECK (action IN ('approve', 'reject')),
    from_status text NOT NULL,
    to_status text NOT NULL,
    reason text,
    decided_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`)

  pgm.sql(`CREATE INDEX booth_attendance_decisions_reservation_idx
    ON dashboard.booth_attendance_decisions (reservation_id)`)

  pgm.sql(`CREATE INDEX booth_reservations_attendance_status_idx
    ON dashboard.booth_reservations (attendance_status)`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS dashboard.booth_attendance_decisions CASCADE`)
  pgm.sql(`DROP INDEX IF EXISTS dashboard.booth_reservations_attendance_status_idx`)
  pgm.sql(`ALTER TABLE dashboard.booth_reservations
    DROP CONSTRAINT IF EXISTS booth_reservations_attendance_status_check`)
  pgm.sql(`ALTER TABLE dashboard.booth_reservations
    DROP COLUMN IF EXISTS attendance_decided_at,
    DROP COLUMN IF EXISTS attendance_decided_by,
    DROP COLUMN IF EXISTS attendance_reason,
    DROP COLUMN IF EXISTS attendance_status`)
}
