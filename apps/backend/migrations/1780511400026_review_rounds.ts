import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- One round per request revision: it fixes the employer snapshot and the
    -- proposal revision the four evaluations are about. A corrected proposal
    -- is a new revision and therefore a new round; earlier rounds are kept.
    CREATE TABLE dashboard.review_rounds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      request_revision integer NOT NULL CHECK (request_revision > 0),
      proposal_revision integer NOT NULL CHECK (proposal_revision > 0),
      employer_id text NOT NULL CHECK (btrim(employer_id) <> ''),
      started_by text NOT NULL,
      started_at timestamptz NOT NULL DEFAULT now(),
      superseded_at timestamptz,
      UNIQUE (request_id, request_revision),
      FOREIGN KEY (request_id, proposal_revision)
        REFERENCES dashboard.request_proposals(request_id, revision)
    );

    CREATE INDEX review_rounds_request_idx ON dashboard.review_rounds (request_id);

    -- Slot assignments are ordinary case assignments (so the evaluation guard
    -- and the scoped queues keep working) tied to the round that created them.
    ALTER TABLE dashboard.case_assignments
      ADD COLUMN round_id uuid REFERENCES dashboard.review_rounds(id),
      ADD COLUMN slot text CHECK (slot IN ('employer', 'ordinary'));

    ALTER TABLE dashboard.case_assignments ADD CONSTRAINT case_assignments_round_slot_consistent CHECK (
      (round_id IS NULL AND slot IS NULL)
      OR (round_id IS NOT NULL AND (
        (slot = 'employer' AND role = 'employer-reviewer')
        OR (slot = 'ordinary' AND role = 'reviewer')
      ))
    );

    -- Four distinct active people per round, exactly one of them the employer.
    CREATE UNIQUE INDEX case_assignments_round_person_active_unique
      ON dashboard.case_assignments (round_id, user_id) WHERE active AND round_id IS NOT NULL;
    CREATE UNIQUE INDEX case_assignments_round_employer_active_unique
      ON dashboard.case_assignments (round_id) WHERE active AND slot = 'employer';
    CREATE INDEX case_assignments_round_idx ON dashboard.case_assignments (round_id);
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Slot assignments exist only with their round.
    DELETE FROM dashboard.case_assignments WHERE round_id IS NOT NULL;
    DROP INDEX IF EXISTS dashboard.case_assignments_round_idx;
    DROP INDEX IF EXISTS dashboard.case_assignments_round_employer_active_unique;
    DROP INDEX IF EXISTS dashboard.case_assignments_round_person_active_unique;
    ALTER TABLE dashboard.case_assignments DROP CONSTRAINT IF EXISTS case_assignments_round_slot_consistent;
    ALTER TABLE dashboard.case_assignments DROP COLUMN IF EXISTS slot, DROP COLUMN IF EXISTS round_id;
    DROP TABLE IF EXISTS dashboard.review_rounds;
  `)
}
