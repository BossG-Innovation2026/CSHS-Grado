CREATE TABLE "school_year" (
	"id" text PRIMARY KEY NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"policy_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_year_term" (
	"school_year_id" text NOT NULL,
	"term" smallint NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"submission_deadline" date,
	CONSTRAINT "school_year_term_school_year_id_term_pk" PRIMARY KEY("school_year_id","term")
);
--> statement-breakpoint
-- The current year must exist before classes reference it through the column default.
INSERT INTO "school_year" ("id", "starts_on", "ends_on", "is_current", "policy_key")
VALUES ('2026-2027', '2026-06-08', '2027-04-08', true, 'transition-2026')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "school_year_term" ("school_year_id", "term")
VALUES ('2026-2027', 1), ('2026-2027', 2), ('2026-2027', 3)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "class_subject" ADD COLUMN "grading_group" text;--> statement-breakpoint
ALTER TABLE "class_subject" ADD COLUMN "credit_units" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "school_year_id" text DEFAULT '2026-2027' NOT NULL;--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "curriculum" text DEFAULT 'strengthened' NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "grading_group" text;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "learning_area" text;--> statement-breakpoint
ALTER TABLE "school_year_term" ADD CONSTRAINT "school_year_term_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "school_year_current_uq" ON "school_year" USING btree ("is_current") WHERE "school_year"."is_current";--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_year_grade_name_uq" ON "class" USING btree ("school_year_id","grade_level_id","name");--> statement-breakpoint
-- DO 015 para. 49: Grade 12 stays on the older curriculum's weights in SY 2026-27.
UPDATE "class" SET "curriculum" = 'do8'
FROM "grade_level"
WHERE "class"."grade_level_id" = "grade_level"."id" AND "grade_level"."name" = 'Grade 12';
--> statement-breakpoint
UPDATE "class_subject" SET "credit_units" = "subject"."credit_units"
FROM "subject"
WHERE "class_subject"."subject_id" = "subject"."id";