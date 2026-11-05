-- 0006_class_term_setup.sql
-- Class subjects become per-term (T1/T2/T3); students and enrollment

-- Rebuild class_subject with a term column. A subject taught all year has
-- one row per term; code uniqueness applies within a single term.
CREATE TABLE class_subject_new (
  id TEXT PRIMARY KEY,
  classId TEXT NOT NULL,
  subjectId TEXT,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  teacherId TEXT,
  term INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (classId) REFERENCES class(id) ON DELETE CASCADE,
  FOREIGN KEY (subjectId) REFERENCES subject(id) ON DELETE SET NULL,
  FOREIGN KEY (teacherId) REFERENCES user(id) ON DELETE SET NULL,
  UNIQUE (classId, code, term)
);

INSERT INTO class_subject_new (id, classId, subjectId, code, title, description, teacherId, term, createdAt)
  SELECT id, classId, subjectId, code, title, description, teacherId, 1, createdAt
  FROM class_subject;

DROP TABLE class_subject;
ALTER TABLE class_subject_new RENAME TO class_subject;

CREATE INDEX class_subject_class_idx ON class_subject(classId);
CREATE INDEX class_subject_teacher_idx ON class_subject(teacherId);

-- Students are not auth accounts: they have an LRN and basic info.
-- Login codes can be generated from them later.
CREATE TABLE student (
  id TEXT PRIMARY KEY,
  lrn TEXT NOT NULL UNIQUE,
  surname TEXT NOT NULL,
  firstname TEXT NOT NULL,
  middlename TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL DEFAULT 'M',
  createdAt INTEGER NOT NULL
);

CREATE TABLE enrollment (
  id TEXT PRIMARY KEY,
  classId TEXT NOT NULL,
  studentId TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (classId) REFERENCES class(id) ON DELETE CASCADE,
  FOREIGN KEY (studentId) REFERENCES student(id) ON DELETE CASCADE,
  UNIQUE (classId, studentId)
);

CREATE INDEX enrollment_class_idx ON enrollment(classId);
CREATE INDEX enrollment_student_idx ON enrollment(studentId);
