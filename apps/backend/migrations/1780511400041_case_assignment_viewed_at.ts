import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- When the assigned reviewer or employer first opened the case (#288). The
    -- round's reviewer list shows «مشاهده نشده» until then. Existing rows stay
    -- NULL: nobody recorded those views, and a draft or final evaluation already
    -- implies the case was read.
    ALTER TABLE dashboard.case_assignments ADD COLUMN viewed_at timestamptz;
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('ALTER TABLE dashboard.case_assignments DROP COLUMN IF EXISTS viewed_at')
}
