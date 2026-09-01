import type { MigrationBuilder } from 'node-pg-migrate'

// Denormalize request display fields so the dashboard can render a request list
// without re-fetching the service definition: `service_name` (service title) and
// `current_step` (the workflow step title at the current index).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('requests', {
    service_name: { type: 'text', notNull: true, default: '' },
    current_step: { type: 'text' },
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('requests', ['current_step', 'service_name'])
}