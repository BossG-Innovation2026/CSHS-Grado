-- 0004_classes.sql
-- Class creation: sections with an adviser and subject-teacher assignments

CREATE TABLE class (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gradeLevelId TEXT NOT NULL,
  adviserId TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (gradeLevelId) REFERENCES grade_level(id) ON DELETE CASCADE,
  FOREIGN KEY (adviserId) REFERENCES user(id) ON DELETE RESTRICT,
  UNIQUE (gradeLevelId, name)
);

-- One row per subject taught in the class. subjectId is NULL for manually
-- added ("Other") subjects; code/title are snapshots so curriculum edits
-- never break an existing class.
CREATE TABLE class_subject (
  id TEXT PRIMARY KEY,
  classId TEXT NOT NULL,
  subjectId TEXT,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  teacherId TEXT,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (classId) REFERENCES class(id) ON DELETE CASCADE,
  FOREIGN KEY (subjectId) REFERENCES subject(id) ON DELETE SET NULL,
  FOREIGN KEY (teacherId) REFERENCES user(id) ON DELETE SET NULL,
  UNIQUE (classId, code)
);

CREATE INDEX class_subject_class_idx ON class_subject(classId);
CREATE INDEX class_subject_teacher_idx ON class_subject(teacherId);
