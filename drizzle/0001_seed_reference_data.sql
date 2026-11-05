-- Reference data every school needs. Safe to re-run (ON CONFLICT DO NOTHING).
-- IDs match the old D1 database so migrated classes/subjects keep their links.
INSERT INTO "grade_level" ("id", "name", "sort_order", "created_at") VALUES
  ('grade-k', 'Kindergarten', 0, to_timestamp(0)),
  ('grade-1', 'Grade 1', 1, to_timestamp(0)),
  ('grade-2', 'Grade 2', 2, to_timestamp(0)),
  ('grade-3', 'Grade 3', 3, to_timestamp(0)),
  ('grade-4', 'Grade 4', 4, to_timestamp(0)),
  ('grade-5', 'Grade 5', 5, to_timestamp(0)),
  ('grade-6', 'Grade 6', 6, to_timestamp(0)),
  ('grade-7', 'Grade 7', 7, to_timestamp(0)),
  ('grade-8', 'Grade 8', 8, to_timestamp(0)),
  ('grade-9', 'Grade 9', 9, to_timestamp(0)),
  ('grade-10', 'Grade 10', 10, to_timestamp(0)),
  ('grade-11', 'Grade 11', 11, to_timestamp(0)),
  ('grade-12', 'Grade 12', 12, to_timestamp(0))
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "school_settings" ("id", "updated_at") VALUES ('school', now())
ON CONFLICT DO NOTHING;
