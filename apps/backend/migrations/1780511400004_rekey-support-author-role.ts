import { MigrationBuilder } from 'node-pg-migrate'

/**
 * Re-key the support ticket author to the single role axis.
 *
 * `support_ticket_messages.author_role` and `letters.sender_role` held the
 * retired `applicant | staff` labels; they now hold `representative | admin`,
 * matching the roles a user can actually hold.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Drop first: the old CHECK rejects the new labels, so the rows cannot be
  // mapped across while it is in place.
  await pgm.sql(`ALTER TABLE "dashboard"."support_ticket_messages" DROP CONSTRAINT IF EXISTS "support_ticket_messages_author_role_check"`)

  await pgm.sql(`UPDATE "dashboard"."support_ticket_messages" SET "author_role" = 'representative' WHERE "author_role" = 'applicant'`)
  await pgm.sql(`UPDATE "dashboard"."support_ticket_messages" SET "author_role" = 'admin' WHERE "author_role" = 'staff'`)
  await pgm.sql(`UPDATE "dashboard"."letters" SET "sender_role" = 'representative' WHERE "sender_role" = 'applicant'`)
  await pgm.sql(`UPDATE "dashboard"."letters" SET "sender_role" = 'admin' WHERE "sender_role" = 'staff'`)

  await pgm.sql(`ALTER TABLE "dashboard"."support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_author_role_check" CHECK ("author_role" IN ('representative', 'admin'))`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  await pgm.sql(`ALTER TABLE "dashboard"."support_ticket_messages" DROP CONSTRAINT IF EXISTS "support_ticket_messages_author_role_check"`)

  await pgm.sql(`UPDATE "dashboard"."support_ticket_messages" SET "author_role" = 'applicant' WHERE "author_role" = 'representative'`)
  await pgm.sql(`UPDATE "dashboard"."support_ticket_messages" SET "author_role" = 'staff' WHERE "author_role" = 'admin'`)

  await pgm.sql(`ALTER TABLE "dashboard"."support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_author_role_check" CHECK ("author_role" IN ('applicant', 'staff'))`)
}