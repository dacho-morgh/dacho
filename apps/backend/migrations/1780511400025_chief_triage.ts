import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Event applications carry a review stage. NULL marks drafts and non-event requests.
    ALTER TABLE dashboard.requests ADD COLUMN review_stage text
      CHECK (review_stage IN ('chief_triage', 'triaged'));

    UPDATE dashboard.requests r
    SET review_stage = 'chief_triage'
    WHERE r.status <> 'draft'
      AND EXISTS (SELECT 1 FROM dashboard.request_rfps rfp WHERE rfp.request_id = r.id);

    -- Submitted answers become part of the immutable revision snapshot so a
    -- correction cannot overwrite what the chief originally reviewed.
    ALTER TABLE dashboard.request_proposals ADD COLUMN answers jsonb;

    ALTER TABLE dashboard.request_proposals DISABLE TRIGGER immutable_request_proposal;
    UPDATE dashboard.request_proposals p
    SET answers = r.answers
    FROM dashboard.requests r
    WHERE r.id = p.request_id AND r.revision = p.revision;
    ALTER TABLE dashboard.request_proposals ENABLE TRIGGER immutable_request_proposal;

    -- Submitted event cases already reach the responsible chief's queue.
    INSERT INTO dashboard.case_assignments (request_id, user_id, role, assigned_by)
    SELECT r.id, e.responsible_chief_id, 'chief-reviewer', 'system'
    FROM dashboard.requests r
    JOIN dashboard.request_rfps rfp ON rfp.request_id = r.id
    JOIN dashboard.events e ON e.id = rfp.event_id
    WHERE r.status <> 'draft'
      AND NOT EXISTS (
        SELECT 1 FROM dashboard.case_assignments a
        WHERE a.request_id = r.id AND a.user_id = e.responsible_chief_id
          AND a.role = 'chief-reviewer' AND a.active
      );

    -- Returning, rejecting and reopening a case must always say why.
    ALTER TABLE dashboard.activities ADD CONSTRAINT activities_triage_reason_required CHECK (
      action IS NULL
      OR action NOT IN ('chief_return', 'chief_reject', 'owner_reopen')
      OR (reason IS NOT NULL AND btrim(reason) <> '')
    );
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE dashboard.activities DROP CONSTRAINT IF EXISTS activities_triage_reason_required;
    ALTER TABLE dashboard.request_proposals DROP COLUMN IF EXISTS answers;
    ALTER TABLE dashboard.requests DROP COLUMN IF EXISTS review_stage;
  `)
}
