import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TABLE dashboard.subtopics ADD CONSTRAINT subtopics_id_event_unique UNIQUE (id, event_id);
    CREATE TABLE dashboard.request_rfps (
      request_id uuid PRIMARY KEY REFERENCES dashboard.requests(id) ON DELETE CASCADE,
      event_id uuid NOT NULL,
      subtopic_id uuid NOT NULL,
      version_id uuid NOT NULL,
      FOREIGN KEY (subtopic_id, event_id) REFERENCES dashboard.subtopics(id, event_id),
      FOREIGN KEY (version_id, subtopic_id) REFERENCES dashboard.rfp_versions(id, subtopic_id)
    );
    CREATE TRIGGER immutable_request_rfp BEFORE UPDATE ON dashboard.request_rfps
      FOR EACH ROW EXECUTE FUNCTION dashboard.reject_rfp_update();`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE dashboard.request_rfps;
    ALTER TABLE dashboard.subtopics DROP CONSTRAINT subtopics_id_event_unique;`)
}
