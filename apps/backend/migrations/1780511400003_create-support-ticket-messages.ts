import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TABLE dashboard.support_ticket_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES dashboard.support_tickets(id) ON DELETE CASCADE,
    author_id text NOT NULL,
    author_role text NOT NULL CHECK (author_role IN ('applicant', 'staff')),
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`)
  pgm.sql('CREATE INDEX support_ticket_messages_ticket_id_created_at_idx ON dashboard.support_ticket_messages (ticket_id, created_at)')
  pgm.sql(`INSERT INTO dashboard.support_ticket_messages (ticket_id, author_id, author_role, body, created_at)
    SELECT id, requester_id, 'applicant', message, created_at FROM dashboard.support_tickets`)
  pgm.sql(`INSERT INTO dashboard.support_ticket_messages (ticket_id, author_id, author_role, body, created_at)
    SELECT id, COALESCE(responded_by, 'staff'), 'staff', response, updated_at
    FROM dashboard.support_tickets WHERE response IS NOT NULL`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS dashboard.support_ticket_messages')
}
