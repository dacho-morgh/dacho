import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- When the requester last opened the conversation. A support answer newer than this (or than
    -- the ticket itself, when never opened) is unread mail for the company.
    ALTER TABLE dashboard.support_tickets
      ADD COLUMN requester_seen_at timestamptz;

    -- The company's feed already knew nothing of its tickets: tell it about those written so far.
    INSERT INTO dashboard.activities
      (owner_id, request_id, letter_id, type, title, description, at, actor_id, action, reason, from_state, to_state, revision)
    SELECT t.requester_id, NULL, NULL, 'transition', 'پیام شما به پشتیبانی ثبت شد', t.subject, t.created_at,
           t.requester_id, 'support_ticket_created', NULL, 'new', 'open', 1
    FROM dashboard.support_tickets t;

    INSERT INTO dashboard.activities
      (owner_id, request_id, letter_id, type, title, description, at, actor_id, action, reason, from_state, to_state, revision)
    SELECT t.requester_id, NULL, NULL, 'transition', 'پشتیبانی به پیام شما پاسخ داد', left(m.body, 200), m.created_at,
           m.author_id, 'support_ticket_answered', NULL, 'open', 'answered', 1
    FROM dashboard.support_ticket_messages m
    JOIN dashboard.support_tickets t ON t.id = m.ticket_id
    WHERE m.author_role = 'admin';
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DELETE FROM dashboard.activities WHERE action IN ('support_ticket_created', 'support_ticket_answered', 'support_ticket_replied');
    ALTER TABLE dashboard.support_tickets DROP COLUMN IF EXISTS requester_seen_at;
  `)
}
