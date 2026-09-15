import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TYPE dashboard.support_ticket_status AS ENUM ('open', 'answered', 'closed')`)
  pgm.sql(`CREATE TABLE dashboard.support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requester_id text NOT NULL,
    subject text NOT NULL, message text NOT NULL,
    status dashboard.support_ticket_status NOT NULL DEFAULT 'open',
    response text, responded_by text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`)
  pgm.sql('CREATE INDEX support_tickets_requester_id_idx ON dashboard.support_tickets (requester_id)')
  pgm.sql('CREATE INDEX support_tickets_status_idx ON dashboard.support_tickets (status)')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.support_tickets')
  pgm.sql('DROP TYPE IF EXISTS dashboard.support_ticket_status')
}
