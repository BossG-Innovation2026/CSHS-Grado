ALTER TABLE "class_subject" ADD COLUMN "ww_weight" smallint DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "class_subject" ADD COLUMN "pt_weight" smallint DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "class_subject" ADD COLUMN "other_weight" smallint DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "grade" ADD COLUMN "written_work" integer;--> statement-breakpoint
ALTER TABLE "grade" ADD COLUMN "performance_task" integer;--> statement-breakpoint
ALTER TABLE "grade" ADD COLUMN "other_assessment" integer;--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "strand" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "school_year" text DEFAULT '' NOT NULL;