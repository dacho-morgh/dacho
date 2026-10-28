import type { MigrationBuilder } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TABLE dashboard.event_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES dashboard.events(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (btrim(title) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, event_id)
  );

  CREATE INDEX event_categories_event_idx ON dashboard.event_categories (event_id);

  CREATE TABLE dashboard.event_subtopics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES dashboard.events(id) ON DELETE CASCADE,
    category_id uuid NOT NULL,
    title text NOT NULL CHECK (btrim(title) <> ''),
    employer_id text NOT NULL CHECK (btrim(employer_id) <> ''),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (category_id, event_id) REFERENCES dashboard.event_categories(id, event_id) ON DELETE CASCADE
  );

  CREATE INDEX event_subtopics_event_idx ON dashboard.event_subtopics (event_id);
  CREATE INDEX event_subtopics_category_idx ON dashboard.event_subtopics (category_id);
  CREATE INDEX event_subtopics_employer_idx ON dashboard.event_subtopics (employer_id);`)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS dashboard.event_subtopics;
DROP TABLE IF EXISTS dashboard.event_categories;`)
}
