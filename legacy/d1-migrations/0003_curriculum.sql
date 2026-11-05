-- 0003_curriculum.sql
-- Curriculum setup: grade levels (K-12) and subjects taught per grade level

CREATE TABLE grade_level (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sortOrder INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE subject (
  id TEXT PRIMARY KEY,
  gradeLevelId TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  terms INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (gradeLevelId) REFERENCES grade_level(id) ON DELETE CASCADE,
  UNIQUE (gradeLevelId, code)
);

CREATE INDEX subject_grade_idx ON subject(gradeLevelId);

INSERT INTO grade_level (id, name, sortOrder, createdAt) VALUES
  ('grade-k', 'Kindergarten', 0, 0),
  ('grade-1', 'Grade 1', 1, 0),
  ('grade-2', 'Grade 2', 2, 0),
  ('grade-3', 'Grade 3', 3, 0),
  ('grade-4', 'Grade 4', 4, 0),
  ('grade-5', 'Grade 5', 5, 0),
  ('grade-6', 'Grade 6', 6, 0),
  ('grade-7', 'Grade 7', 7, 0),
  ('grade-8', 'Grade 8', 8, 0),
  ('grade-9', 'Grade 9', 9, 0),
  ('grade-10', 'Grade 10', 10, 0),
  ('grade-11', 'Grade 11', 11, 0),
  ('grade-12', 'Grade 12', 12, 0);
