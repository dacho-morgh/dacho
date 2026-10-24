import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE public.enum_users_operational_role AS ENUM ('system-owner', 'central-secretariat', 'chief-reviewer', 'reviewer', 'employer-reviewer', 'investment-reviewer', 'representative');
    ALTER TABLE public.users ADD COLUMN operational_role public.enum_users_operational_role;
    ALTER TABLE public.users ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    ALTER TABLE public.users ADD COLUMN content_editor boolean NOT NULL DEFAULT false;
    ALTER TABLE public.users ADD COLUMN backend_service boolean NOT NULL DEFAULT false;
    ALTER TABLE public.users ADD COLUMN legacy_roles jsonb;
    ALTER TABLE public.users ADD COLUMN personnel_history jsonb;
    UPDATE public.users u SET legacy_roles = COALESCE((SELECT jsonb_agg(r.value::text ORDER BY r."order") FROM public.users_roles r WHERE r.parent_id = u.id), '[]'::jsonb);
    UPDATE public.users SET content_editor = legacy_roles ? 'editor';
    -- Only unambiguous existing workflow roles are mapped. Neither the old
    -- admin label nor an email address can grant owner or service authority.
    UPDATE public.users SET operational_role = 'representative' WHERE legacy_roles ? 'representative' AND NOT legacy_roles ?| ARRAY['admin', 'referee'];
    UPDATE public.users SET operational_role = 'reviewer' WHERE legacy_roles ? 'referee' AND NOT legacy_roles ?| ARRAY['admin', 'representative'];
    UPDATE public.users SET is_active = false WHERE operational_role IS NULL AND (NOT content_editor OR legacy_roles ? 'admin' OR legacy_roles ? 'referee' OR legacy_roles ? 'representative');
    DELETE FROM public.users_roles;
    INSERT INTO public.users_roles ("order", parent_id, value)
      SELECT 1, id, 'representative'::public.enum_users_role FROM public.users WHERE is_active AND operational_role = 'representative'
      UNION ALL SELECT 1, id, 'referee'::public.enum_users_role FROM public.users WHERE is_active AND operational_role = 'reviewer'
      UNION ALL SELECT 2, id, 'editor'::public.enum_users_role FROM public.users WHERE is_active AND content_editor;
  `)
}
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('Personnel migration requires reviewed restore or forward repair; legacy assignments are retained in users.legacy_roles.')
}
