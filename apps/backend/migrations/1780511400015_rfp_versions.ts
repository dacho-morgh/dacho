import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TABLE dashboard.rfp_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subtopic_id uuid NOT NULL REFERENCES dashboard.subtopics(id) ON DELETE CASCADE,
    created_by text NOT NULL,
    reason text NOT NULL CHECK (btrim(reason) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, subtopic_id)
  );
  ALTER TABLE dashboard.subtopics ADD COLUMN current_rfp_version_id uuid;
  ALTER TABLE dashboard.subtopics ADD CONSTRAINT subtopic_current_rfp_fk
    FOREIGN KEY (current_rfp_version_id, id) REFERENCES dashboard.rfp_versions(id, subtopic_id);
  CREATE TABLE dashboard.rfp_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL REFERENCES dashboard.rfp_versions(id) ON DELETE CASCADE,
    storage_key text NOT NULL UNIQUE,
    filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10000000),
    position integer NOT NULL,
    UNIQUE (version_id, position)
  );
  CREATE FUNCTION dashboard.reject_rfp_update() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN RAISE EXCEPTION 'RFP records are immutable'; END $$;
  CREATE TRIGGER immutable_rfp_version BEFORE UPDATE ON dashboard.rfp_versions
    FOR EACH ROW EXECUTE FUNCTION dashboard.reject_rfp_update();
  CREATE TRIGGER immutable_rfp_file BEFORE UPDATE ON dashboard.rfp_files
    FOR EACH ROW EXECUTE FUNCTION dashboard.reject_rfp_update();`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE dashboard.subtopics DROP CONSTRAINT subtopic_current_rfp_fk;
    ALTER TABLE dashboard.subtopics DROP COLUMN current_rfp_version_id;
    DROP TABLE dashboard.rfp_files;
    DROP TABLE dashboard.rfp_versions;
    DROP FUNCTION dashboard.reject_rfp_update();`)
}
