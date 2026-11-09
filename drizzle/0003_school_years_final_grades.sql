CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "final_grade" (
	"class_subject_id" text NOT NULL,
	"student_id" text NOT NULL,
	"grade" smallint NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "final_grade_class_subject_id_student_id_pk" PRIMARY KEY("class_subject_id","student_id"),
	CONSTRAINT "final_grade_range" CHECK ("final_grade"."grade" between 60 and 100)
);
--> statement-breakpoint
CREATE TABLE "grade_submission" (
	"class_subject_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"return_note" text
);
--> statement-breakpoint
CREATE TABLE "school_year" (
	"id" text PRIMARY KEY NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
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
INSERT INTO "school_year" ("id", "starts_on", "ends_on", "is_current")
VALUES ('2026-2027', '2026-06-08', '2027-04-08', true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "school_year_term" ("school_year_id", "term")
VALUES ('2026-2027', 1), ('2026-2027', 2), ('2026-2027', 3)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "school_year_id" text DEFAULT '2026-2027' NOT NULL;--> statement-breakpoint
ALTER TABLE "final_grade" ADD CONSTRAINT "final_grade_class_subject_id_class_subject_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subject"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_grade" ADD CONSTRAINT "final_grade_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_grade" ADD CONSTRAINT "final_grade_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_submission" ADD CONSTRAINT "grade_submission_class_subject_id_class_subject_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subject"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_submission" ADD CONSTRAINT "grade_submission_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_submission" ADD CONSTRAINT "grade_submission_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_term" ADD CONSTRAINT "school_year_term_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "final_grade_student_idx" ON "final_grade" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_year_current_uq" ON "school_year" USING btree ("is_current") WHERE "school_year"."is_current";--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_school_year_id_school_year_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_year"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_year_grade_name_uq" ON "class" USING btree ("school_year_id","grade_level_id","name");