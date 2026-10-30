import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- One row per replacement of a round slot: who left, who took over, who did
    -- it and why. Assignments themselves are never rewritten, so the earlier
    -- person's revoked assignment and any stored evaluation stay as history.
    CREATE TABLE dashboard.review_replacements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      round_id uuid NOT NULL REFERENCES dashboard.review_rounds(id),
      slot text NOT NULL CHECK (slot IN ('employer', 'ordinary')),
      old_assignment_id uuid NOT NULL REFERENCES dashboard.case_assignments(id),
      new_assignment_id uuid NOT NULL REFERENCES dashboard.case_assignments(id),
      old_user_id text NOT NULL CHECK (btrim(old_user_id) <> ''),
      new_user_id text NOT NULL CHECK (btrim(new_user_id) <> ''),
      replaced_by text NOT NULL CHECK (btrim(replaced_by) <> ''),
      reason text,
      replaced_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT review_replacements_different_people CHECK (old_user_id <> new_user_id),
      -- Changing the employer is the owner's exceptional act and must say why.
      CONSTRAINT review_replacements_employer_reason CHECK (
        slot <> 'employer' OR (reason IS NOT NULL AND btrim(reason) <> '')
      ),
      CONSTRAINT review_replacements_old_assignment_once UNIQUE (old_assignment_id)
    );

    CREATE INDEX review_replacements_request_idx ON dashboard.review_replacements (request_id, replaced_at);
    CREATE INDEX review_replacements_round_idx ON dashboard.review_replacements (round_id);

    -- The owner's employer replacement must always carry its reason in the history too.
    ALTER TABLE dashboard.activities DROP CONSTRAINT activities_triage_reason_required;
    ALTER TABLE dashboard.activities ADD CONSTRAINT activities_triage_reason_required CHECK (
      action IS NULL
      OR action NOT IN ('chief_return', 'chief_reject', 'owner_reopen', 'owner_replace_employer')
      OR (reason IS NOT NULL AND btrim(reason) <> '')
    );
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE dashboard.activities DROP CONSTRAINT IF EXISTS activities_triage_reason_required;
    ALTER TABLE dashboard.activities ADD CONSTRAINT activities_triage_reason_required CHECK (
      action IS NULL
      OR action NOT IN ('chief_return', 'chief_reject', 'owner_reopen')
      OR (reason IS NOT NULL AND btrim(reason) <> '')
    );
    DROP TABLE IF EXISTS dashboard.review_replacements;
  `)
}
