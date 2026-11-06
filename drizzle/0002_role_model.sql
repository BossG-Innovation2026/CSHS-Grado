-- New role model (2026-11): System Admin, School Head, Department Head,
-- Registrar, Teacher. "Admin" merges into System Admin; "Coordinator" becomes
-- Department Head. System Admins always have every module (enforced in code).
UPDATE "user" SET "role" = 'system_admin', "updated_at" = now() WHERE "role" IN ('super_admin', 'admin');
--> statement-breakpoint
UPDATE "user" SET "role" = 'department_head', "updated_at" = now() WHERE "role" = 'coordinator';
