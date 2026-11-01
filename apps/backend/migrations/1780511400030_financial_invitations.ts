import type { MigrationBuilder } from 'node-pg-migrate'

// A migration stays as written: this copy does not follow later checklist versions.
const CHECKLIST = [
  { category: 'financialStatements', title: 'صورت‌های مالی', description: 'صورت‌های مالی حداقل سه سال اخیر؛ برای شرکت جوان‌تر، از زمان تأسیس.' },
  { category: 'debtFacilityEvidence', title: 'بدهی‌ها و تسهیلات', description: 'بدهی‌ها و تسهیلات اعتباری جاری.' },
  { category: 'taxInsuranceRecords', title: 'اظهارنامه مالیاتی و بیمه', description: 'اظهارنامه یا گزارش مالیاتی و وضعیت بیمه مرتبط.' },
  { category: 'contractsOrdersMousCommitments', title: 'قراردادها و تعهدات', description: 'قراردادها، سفارش‌های خرید، تفاهم‌نامه‌ها و تعهدات جاری.' },
  { category: 'projectEstimateUseOfFunds', title: 'برآورد و مصرف منابع', description: 'برآورد مالی پروژه و برنامه مصرف منابع.' },
  { category: 'guaranteeCollateral', title: 'تضامین و وثایق', description: 'مدارک تضامین و وثایق موجود.' },
]

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- One invitation per advanced round. It pins the case revision and the reviewed
    -- proposal, and keeps the checklist the company was actually asked for.
    CREATE TABLE dashboard.financial_invitations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      review_round_id uuid NOT NULL UNIQUE REFERENCES dashboard.review_rounds(id) ON DELETE CASCADE,
      request_revision integer NOT NULL CHECK (request_revision > 0),
      proposal_revision integer NOT NULL CHECK (proposal_revision > 0),
      checklist_version text NOT NULL CHECK (btrim(checklist_version) <> ''),
      checklist jsonb NOT NULL CHECK (jsonb_typeof(checklist) = 'array' AND jsonb_array_length(checklist) > 0),
      invited_by text NOT NULL CHECK (btrim(invited_by) <> ''),
      invited_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX financial_invitations_request_idx ON dashboard.financial_invitations (request_id);

    -- Cases advanced before this migration get their invitation, but no second notification.
    INSERT INTO dashboard.financial_invitations
      (request_id, review_round_id, request_revision, proposal_revision, checklist_version, checklist, invited_by, invited_at)
    SELECT r.id, rr.id, rr.request_revision + 1, rr.proposal_revision,
           'financial-package-2026-v1', '${JSON.stringify(CHECKLIST)}'::jsonb, rr.decided_by, rr.decided_at
    FROM dashboard.review_rounds rr
    JOIN dashboard.requests r ON r.id = rr.request_id
    WHERE rr.decision = 'advance' AND r.review_stage = 'advanced';
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS dashboard.financial_invitations;`)
}
