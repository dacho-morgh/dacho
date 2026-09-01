import type { MigrationBuilder } from 'node-pg-migrate'

// Denormalize request display fields so the dashboard can render a request list
// without re-fetching the service definition: `service_name` (service title) and
// `current_step` (the workflow step title at the current index).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql("ALTER TABLE dashboard.requests ADD COLUMN service_name text NOT NULL DEFAULT ''")
  pgm.sql('ALTER TABLE dashboard.requests ADD COLUMN current_step text')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('ALTER TABLE dashboard.requests DROP COLUMN current_step')
  pgm.sql('ALTER TABLE dashboard.requests DROP COLUMN service_name')
}