import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Rename the multi-valued user role field role -> roles. The retired dynamic
 * role and workflow tables remain as legacy data, outside the current config.
 *
 * The role field was already multi-valued (a users_role join table, one row per role),
 * so the rename is purely to make the plural match the behaviour — a user holds
 * any number of roles.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Rename the join table to follow the field name.
    ALTER TABLE "users_role" RENAME TO "users_roles";
    ALTER SEQUENCE "users_role_id_seq" RENAME TO "users_roles_id_seq";
    ALTER TABLE "users_roles" RENAME CONSTRAINT "users_role_parent_id_value_order_unique" TO "users_roles_parent_id_value_order_unique";
    ALTER TABLE "users_roles" RENAME CONSTRAINT "users_role_pkey" TO "users_roles_pkey";
    ALTER TABLE "users_roles" RENAME CONSTRAINT "users_role_parent_fk" TO "users_roles_parent_fk";
    ALTER INDEX "users_role_order_idx" RENAME TO "users_roles_order_idx";
    ALTER INDEX "users_role_parent_idx" RENAME TO "users_roles_parent_idx";

    -- Legacy workflow definitions and role relationships are retained so
    -- upgrading an existing database never silently deletes its content.
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users_roles" RENAME TO "users_role";
    ALTER SEQUENCE "users_roles_id_seq" RENAME TO "users_role_id_seq";
    ALTER TABLE "users_role" RENAME CONSTRAINT "users_roles_parent_id_value_order_unique" TO "users_role_parent_id_value_order_unique";
    ALTER TABLE "users_role" RENAME CONSTRAINT "users_roles_pkey" TO "users_role_pkey";
    ALTER TABLE "users_role" RENAME CONSTRAINT "users_roles_parent_fk" TO "users_role_parent_fk";
    ALTER INDEX "users_roles_order_idx" RENAME TO "users_role_order_idx";
    ALTER INDEX "users_roles_parent_idx" RENAME TO "users_role_parent_idx";
  `)
}
