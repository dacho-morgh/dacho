import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TABLE dashboard.notification_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
    recipient_id text NOT NULL,
    actor_id text NOT NULL,
    action text NOT NULL,
    from_state text NOT NULL,
    to_state text NOT NULL,
    revision integer NOT NULL,
    channel text NOT NULL DEFAULT 'in_app',
    title text NOT NULL,
    body text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    attempts integer NOT NULL DEFAULT 0,
    last_error text,
    letter_id uuid REFERENCES dashboard.letters(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    CONSTRAINT notification_jobs_unique_transition UNIQUE (request_id, revision, action, recipient_id)
  );

  CREATE INDEX notification_jobs_status_idx ON dashboard.notification_jobs (status);
  CREATE INDEX notification_jobs_request_idx ON dashboard.notification_jobs (request_id);
  CREATE INDEX notification_jobs_recipient_idx ON dashboard.notification_jobs (recipient_id);`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS dashboard.notification_jobs CASCADE;`)
}
