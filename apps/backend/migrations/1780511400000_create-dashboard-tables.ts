import type { MigrationBuilder } from 'node-pg-migrate'

// Backend-owned dashboard tables (public schema): requests, letters, activities.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType('request_status', ['draft', 'in_review', 'action_needed', 'approved', 'rejected'])
  pgm.createType('letter_type', ['rejected', 'approved', 'needs_fix', 'official', 'notification'])

  pgm.createTable('requests', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    tracking_code: { type: 'text', notNull: true, unique: true },
    title: { type: 'text', notNull: true },
    service_id: { type: 'text', notNull: true },
    service_key: { type: 'text', notNull: true },
    owner_id: { type: 'text', notNull: true },
    status: { type: 'request_status', notNull: true, default: 'draft' },
    current_step_index: { type: 'integer', notNull: true, default: 0 },
    assigned_role: { type: 'text' },
    answers: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    submission_date: { type: 'timestamptz' },
    due_date: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('letters', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    type: { type: 'letter_type', notNull: true },
    title: { type: 'text', notNull: true },
    body: { type: 'text', notNull: true },
    sender_id: { type: 'text' },
    sender_name: { type: 'text' },
    sender_role: { type: 'text' },
    recipient_id: { type: 'text', notNull: true },
    request_id: { type: 'uuid', references: 'requests', onDelete: 'SET NULL' },
    read: { type: 'boolean', notNull: true, default: false },
    sent_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    attachments: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createTable('activities', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    owner_id: { type: 'text', notNull: true },
    request_id: { type: 'uuid', references: 'requests', onDelete: 'SET NULL' },
    letter_id: { type: 'uuid', references: 'letters', onDelete: 'SET NULL' },
    type: { type: 'text', notNull: true },
    title: { type: 'text', notNull: true },
    description: { type: 'text' },
    at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  })

  pgm.createIndex('requests', 'owner_id')
  pgm.createIndex('requests', 'status')
  pgm.createIndex('letters', 'recipient_id')
  pgm.createIndex('letters', 'request_id')
  pgm.createIndex('activities', 'owner_id')
  pgm.createIndex('activities', 'at')
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('activities')
  pgm.dropTable('letters')
  pgm.dropTable('requests')
  pgm.dropType('letter_type')
  pgm.dropType('request_status')
}
