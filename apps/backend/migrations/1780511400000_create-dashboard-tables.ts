import type { MigrationBuilder } from 'node-pg-migrate'

// Backend-owned dashboard tables live in a dedicated `dashboard` schema so
// Payload's `public` schema push never sees them as foreign tables to drop.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('CREATE SCHEMA IF NOT EXISTS dashboard')
  pgm.sql(`CREATE TYPE dashboard.request_status AS ENUM ('draft', 'in_review', 'action_needed', 'approved', 'rejected')`)
  pgm.sql(`CREATE TYPE dashboard.letter_type AS ENUM ('rejected', 'approved', 'needs_fix', 'official', 'notification')`)

  pgm.sql(`CREATE TABLE dashboard.requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_code text NOT NULL UNIQUE,
    title text NOT NULL,
    service_id text NOT NULL,
    service_key text NOT NULL,
    owner_id text NOT NULL,
    status dashboard.request_status NOT NULL DEFAULT 'draft',
    current_step_index integer NOT NULL DEFAULT 0,
    assigned_role text,
    answers jsonb NOT NULL DEFAULT '{}'::jsonb,
    submission_date timestamptz,
    due_date timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)

  pgm.sql(`CREATE TABLE dashboard.letters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type dashboard.letter_type NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    sender_id text,
    sender_name text,
    sender_role text,
    recipient_id text NOT NULL,
    request_id uuid REFERENCES dashboard.requests(id) ON DELETE SET NULL,
    read boolean NOT NULL DEFAULT false,
    sent_at timestamptz NOT NULL DEFAULT now(),
    attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`)

  pgm.sql(`CREATE TABLE dashboard.activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id text NOT NULL,
    request_id uuid REFERENCES dashboard.requests(id) ON DELETE SET NULL,
    letter_id uuid REFERENCES dashboard.letters(id) ON DELETE SET NULL,
    type text NOT NULL,
    title text NOT NULL,
    description text,
    at timestamptz NOT NULL DEFAULT now()
  )`)

  pgm.sql('CREATE INDEX requests_owner_id_idx ON dashboard.requests (owner_id)')
  pgm.sql('CREATE INDEX requests_status_idx ON dashboard.requests (status)')
  pgm.sql('CREATE INDEX letters_recipient_id_idx ON dashboard.letters (recipient_id)')
  pgm.sql('CREATE INDEX letters_request_id_idx ON dashboard.letters (request_id)')
  pgm.sql('CREATE INDEX activities_owner_id_idx ON dashboard.activities (owner_id)')
  pgm.sql('CREATE INDEX activities_at_idx ON dashboard.activities (at)')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP SCHEMA IF EXISTS dashboard CASCADE')
}