import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Exclude writers while finding the high-water mark. Existing codes are kept.
  pgm.sql('LOCK TABLE dashboard.requests IN SHARE ROW EXCLUSIVE MODE')
  pgm.sql('CREATE SEQUENCE dashboard.request_tracking_code_seq AS bigint')
  pgm.sql(`SELECT setval(
    'dashboard.request_tracking_code_seq',
    COALESCE(MAX(substring(tracking_code FROM '^DCH-[0-9]{4}-([0-9]+)$')::bigint), 0) + 1,
    false
  ) FROM dashboard.requests`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP SEQUENCE dashboard.request_tracking_code_seq')
}
