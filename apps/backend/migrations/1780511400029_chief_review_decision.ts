import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- The chief's explicit advancement after 4/4; the financial stage (T29) opens from here.
    ALTER TABLE dashboard.requests DROP CONSTRAINT requests_review_stage_check;
    ALTER TABLE dashboard.requests ADD CONSTRAINT requests_review_stage_check
      CHECK (review_stage IN ('chief_triage', 'triaged', 'advanced'));

    -- One decision per round, on the round it decided. Only a complete round can
    -- be decided, and sending a case back or rejecting it must always say why.
    ALTER TABLE dashboard.review_rounds
      ADD COLUMN decision text CHECK (decision IN ('advance', 'return', 'reject')),
      ADD COLUMN decided_by text,
      ADD COLUMN decided_at timestamptz,
      ADD COLUMN decision_reason text;

    ALTER TABLE dashboard.review_rounds ADD CONSTRAINT review_rounds_decision_consistent CHECK (
      (decision IS NULL AND decided_by IS NULL AND decided_at IS NULL AND decision_reason IS NULL)
      OR (
        decision IS NOT NULL AND decided_at IS NOT NULL AND completed_at IS NOT NULL
        AND decided_by IS NOT NULL AND btrim(decided_by) <> ''
        AND (decision = 'advance' OR (decision_reason IS NOT NULL AND btrim(decision_reason) <> ''))
      )
    );

    ALTER TABLE dashboard.activities DROP CONSTRAINT activities_triage_reason_required;
    ALTER TABLE dashboard.activities ADD CONSTRAINT activities_triage_reason_required CHECK (
      action IS NULL
      OR action NOT IN (
        'chief_return', 'chief_reject', 'owner_reopen', 'owner_replace_employer',
        'chief_review_return', 'chief_review_reject'
      )
      OR (reason IS NOT NULL AND btrim(reason) <> '')
    );
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE dashboard.activities DROP CONSTRAINT IF EXISTS activities_triage_reason_required;
    ALTER TABLE dashboard.activities ADD CONSTRAINT activities_triage_reason_required CHECK (
      action IS NULL
      OR action NOT IN ('chief_return', 'chief_reject', 'owner_reopen', 'owner_replace_employer')
      OR (reason IS NOT NULL AND btrim(reason) <> '')
    );

    ALTER TABLE dashboard.review_rounds DROP CONSTRAINT IF EXISTS review_rounds_decision_consistent;
    ALTER TABLE dashboard.review_rounds
      DROP COLUMN IF EXISTS decision_reason,
      DROP COLUMN IF EXISTS decided_at,
      DROP COLUMN IF EXISTS decided_by,
      DROP COLUMN IF EXISTS decision;

    -- An advanced case has no stage before this migration; it returns to its finished round.
    ALTER TABLE dashboard.requests DROP CONSTRAINT IF EXISTS requests_review_stage_check;
    UPDATE dashboard.requests SET review_stage = 'triaged' WHERE review_stage = 'advanced';
    ALTER TABLE dashboard.requests ADD CONSTRAINT requests_review_stage_check
      CHECK (review_stage IN ('chief_triage', 'triaged'));
  `)
}
