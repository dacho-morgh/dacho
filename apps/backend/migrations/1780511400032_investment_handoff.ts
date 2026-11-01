import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Packages submitted before T31 reached nobody. Each case's latest package goes to its
    -- event's responsible person, the only investment person who may hold the case from here on.
    WITH handed_off AS (
      SELECT DISTINCT p.request_id, e.responsible_investment_id AS user_id
      FROM dashboard.financial_packages p
      JOIN dashboard.request_rfps rfp ON rfp.request_id = p.request_id
      JOIN dashboard.events e ON e.id = rfp.event_id
    )
    UPDATE dashboard.case_assignments a
    SET active = false, revoked_by = 'system', revoked_at = now(), revoke_reason = 'investment_handoff'
    FROM handed_off h
    WHERE a.request_id = h.request_id AND a.role = 'investment-reviewer' AND a.active AND a.user_id <> h.user_id;

    INSERT INTO dashboard.case_assignments (request_id, user_id, role, assigned_by)
    SELECT DISTINCT p.request_id, e.responsible_investment_id, 'investment-reviewer'::dashboard.case_assignment_role, 'system'
    FROM dashboard.financial_packages p
    JOIN dashboard.request_rfps rfp ON rfp.request_id = p.request_id
    JOIN dashboard.events e ON e.id = rfp.event_id
    ON CONFLICT (request_id, user_id, role) WHERE active DO NOTHING;
  `)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    -- Handoff access exists only with T31. Revoked rows stay as history; hand-made grants stay active.
    UPDATE dashboard.case_assignments
    SET active = false, revoked_by = 'system', revoked_at = now(), revoke_reason = 'investment_handoff_rollback'
    WHERE role = 'investment-reviewer' AND assigned_by = 'system' AND active;
  `)
}
