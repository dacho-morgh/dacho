import type { MigrationBuilder } from 'node-pg-migrate'

// T13 backend SQL path: no schema change is required.
//
// The dossier columns and array tables live in Payload's `public.companies`
// schema and are owned by the cms-core migration
// `20261026_120000_company_dossier`. The backend reads dossier document
// presence from the existing `dashboard.private_documents` table, whose
// `(company_id)` index already covers the lookup. This migration is
// intentionally empty so the backend migration sequence records the boundary
// and nobody moves the CMS schema into `dashboard`.
export async function up(_pgm: MigrationBuilder): Promise<void> {}

export async function down(_pgm: MigrationBuilder): Promise<void> {}
