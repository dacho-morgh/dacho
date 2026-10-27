import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TABLE dashboard.technology_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES dashboard.events(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (btrim(title) <> ''),
    UNIQUE (id, event_id)
  );
  CREATE TABLE dashboard.subtopics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES dashboard.events(id) ON DELETE CASCADE,
    category_id uuid NOT NULL,
    title text NOT NULL CHECK (btrim(title) <> ''),
    employer_id text NOT NULL CHECK (btrim(employer_id) <> ''),
    FOREIGN KEY (category_id, event_id) REFERENCES dashboard.technology_categories(id, event_id)
  );`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE dashboard.subtopics; DROP TABLE dashboard.technology_categories;')
}
