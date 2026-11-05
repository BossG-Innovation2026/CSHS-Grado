-- 0005_subject_description.sql
-- Manual per-class description field for class subjects

ALTER TABLE class_subject ADD COLUMN description TEXT NOT NULL DEFAULT '';
