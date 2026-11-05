-- 0007_subject_credit_units.sql
-- Add credit unit value to subjects

ALTER TABLE subject ADD COLUMN creditUnits INTEGER NOT NULL DEFAULT 1;
