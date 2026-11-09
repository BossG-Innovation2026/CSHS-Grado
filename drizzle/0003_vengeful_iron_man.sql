CREATE TABLE "academic_record" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"school_name" text DEFAULT '' NOT NULL,
	"school_year" text DEFAULT '' NOT NULL,
	"grade_level" text DEFAULT '' NOT NULL,
	"general_average" text DEFAULT '' NOT NULL,
	"honors" text DEFAULT '' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"subjects" text DEFAULT '[]' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_name" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"entity" text DEFAULT '' NOT NULL,
	"entity_id" text DEFAULT '' NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade" (
	"id" text PRIMARY KEY NOT NULL,
	"class_subject_id" text NOT NULL,
	"student_id" text NOT NULL,
	"value" integer,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"class_subject_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"adviser_verified_by" text,
	"adviser_verified_at" timestamp with time zone,
	"registrar_verified_by" text,
	"registrar_verified_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"return_note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_link" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"student_id" text NOT NULL,
	"relationship" text DEFAULT 'Parent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_surrender" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"class_id" text,
	"reason" text DEFAULT 'graduated' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"surrendered_by" text,
	"surrendered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_by" text,
	"received_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signed_sheet" (
	"id" text PRIMARY KEY NOT NULL,
	"class_subject_id" text NOT NULL,
	"reference_no" text DEFAULT '' NOT NULL,
	"received_by" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "birth_date" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "parent_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "parent_contact" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "academic_record" ADD CONSTRAINT "academic_record_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade" ADD CONSTRAINT "grade_class_subject_id_class_subject_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade" ADD CONSTRAINT "grade_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade" ADD CONSTRAINT "grade_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_submission" ADD CONSTRAINT "grade_submission_class_subject_id_class_subject_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_submission" ADD CONSTRAINT "grade_submission_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_submission" ADD CONSTRAINT "grade_submission_adviser_verified_by_user_id_fk" FOREIGN KEY ("adviser_verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_submission" ADD CONSTRAINT "grade_submission_registrar_verified_by_user_id_fk" FOREIGN KEY ("registrar_verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_submission" ADD CONSTRAINT "grade_submission_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_link" ADD CONSTRAINT "parent_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_link" ADD CONSTRAINT "parent_link_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_surrender" ADD CONSTRAINT "record_surrender_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_surrender" ADD CONSTRAINT "record_surrender_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_surrender" ADD CONSTRAINT "record_surrender_surrendered_by_user_id_fk" FOREIGN KEY ("surrendered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_surrender" ADD CONSTRAINT "record_surrender_received_by_user_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_sheet" ADD CONSTRAINT "signed_sheet_class_subject_id_class_subject_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "public"."class_subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_sheet" ADD CONSTRAINT "signed_sheet_received_by_user_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_record_student_idx" ON "academic_record" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_class_subject_student_uq" ON "grade" USING btree ("class_subject_id","student_id");--> statement-breakpoint
CREATE INDEX "grade_student_idx" ON "grade" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_submission_class_subject_uq" ON "grade_submission" USING btree ("class_subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parent_link_user_student_uq" ON "parent_link" USING btree ("user_id","student_id");--> statement-breakpoint
CREATE INDEX "parent_link_student_idx" ON "parent_link" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "record_surrender_student_idx" ON "record_surrender" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "record_surrender_status_idx" ON "record_surrender" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signed_sheet_class_subject_idx" ON "signed_sheet" USING btree ("class_subject_id");