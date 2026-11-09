/**
 * Database schema (PostgreSQL) — the single source of truth for tables.
 *
 * - Edit this file, then run `npm run db:generate` to create a SQL migration
 *   in `drizzle/`, and `npm run db:migrate` to apply it.
 * - JS property names are camelCase (what the app and better-auth use);
 *   column names are snake_case (Postgres convention).
 * - The auth tables (user, session, account, verification, rateLimit) follow
 *   better-auth's model. Their JS keys must keep these exact names.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* ------------------------------------------------------------------ */
/* Auth (better-auth)                                                  */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  // App fields (declared as better-auth additionalFields in src/lib/auth.ts)
  role: text("role").notNull().default("teacher"),
  /** JSON array of module keys, e.g. ["classes","curriculum"]. */
  permissions: text("permissions").notNull().default("[]"),
  active: boolean("active").notNull().default(true),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamptz("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

/** Shared rate-limit counters, so limits hold across all Worker isolates. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ------------------------------------------------------------------ */
/* School                                                              */
/* ------------------------------------------------------------------ */

export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    type: text("type").notNull().default("info"),
    readAt: timestamptz("read_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("notification_user_idx").on(t.userId)]
);

export const schoolSettings = pgTable("school_settings", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  address: text("address").notNull().default(""),
  schoolId: text("school_id").notNull().default(""),
  principal: text("principal").notNull().default(""),
  updatedAt: timestamptz("updated_at"),
});

/* ------------------------------------------------------------------ */
/* Curriculum                                                          */
/* ------------------------------------------------------------------ */

/** A school year; exactly one is current. */
export const schoolYear = pgTable(
  "school_year",
  {
    id: text("id").primaryKey(), // e.g. 2026-2027
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("school_year_current_uq").on(t.isCurrent).where(sql`${t.isCurrent}`)]
);

export const schoolYearTerm = pgTable(
  "school_year_term",
  {
    schoolYearId: text("school_year_id")
      .notNull()
      .references(() => schoolYear.id, { onDelete: "cascade" }),
    term: smallint("term").notNull(),
    startsOn: date("starts_on", { mode: "string" }),
    endsOn: date("ends_on", { mode: "string" }),
    submissionDeadline: date("submission_deadline", { mode: "string" }),
  },
  (t) => [primaryKey({ columns: [t.schoolYearId, t.term] })]
);

export const gradeLevel = pgTable("grade_level", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const subject = pgTable(
  "subject",
  {
    id: text("id").primaryKey(),
    gradeLevelId: text("grade_level_id")
      .notNull()
      .references(() => gradeLevel.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    terms: smallint("terms").notNull().default(1),
    creditUnits: smallint("credit_units").notNull().default(1),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subject_grade_code_uq").on(t.gradeLevelId, t.code),
    index("subject_grade_idx").on(t.gradeLevelId),
  ]
);

/* ------------------------------------------------------------------ */
/* Classes, students, enrollment                                       */
/* ------------------------------------------------------------------ */

export const schoolClass = pgTable(
  "class",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    gradeLevelId: text("grade_level_id")
      .notNull()
      .references(() => gradeLevel.id, { onDelete: "cascade" }),
    adviserId: text("adviser_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    // The default lets the previous release keep inserting while it is live; drop it next release.
    schoolYearId: text("school_year_id")
      .notNull()
      .default("2026-2027")
      .references(() => schoolYear.id, { onDelete: "restrict" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Superseded by class_year_grade_name_uq. Drop it next release, before a second school
    // year needs the same section names; the previous release's ON CONFLICT targets it.
    uniqueIndex("class_grade_name_uq").on(t.gradeLevelId, t.name),
    uniqueIndex("class_year_grade_name_uq").on(t.schoolYearId, t.gradeLevelId, t.name),
    index("class_adviser_idx").on(t.adviserId),
  ]
);

/**
 * One row per subject taught in a class, per term. `code`/`title` are
 * snapshots so curriculum edits never break an existing class; `subjectId`
 * is NULL for manually added subjects.
 */
export const classSubject = pgTable(
  "class_subject",
  {
    id: text("id").primaryKey(),
    classId: text("class_id")
      .notNull()
      .references(() => schoolClass.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").references(() => subject.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    teacherId: text("teacher_id").references(() => user.id, { onDelete: "set null" }),
    term: smallint("term").notNull().default(1),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("class_subject_class_code_term_uq").on(t.classId, t.code, t.term),
    index("class_subject_class_idx").on(t.classId),
    index("class_subject_teacher_idx").on(t.teacherId),
  ]
);

/** Students are not auth accounts: they have an LRN and basic info. */
export const student = pgTable(
  "student",
  {
    id: text("id").primaryKey(),
    lrn: text("lrn").notNull().unique(),
    surname: text("surname").notNull(),
    firstname: text("firstname").notNull(),
    middlename: text("middlename").notNull().default(""),
    sex: text("sex").notNull().default("M"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("student_name_idx").on(sql`lower(${t.surname})`, sql`lower(${t.firstname})`)]
);

export const enrollment = pgTable(
  "enrollment",
  {
    id: text("id").primaryKey(),
    classId: text("class_id")
      .notNull()
      .references(() => schoolClass.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("enrollment_class_student_uq").on(t.classId, t.studentId),
    index("enrollment_student_idx").on(t.studentId),
  ]
);

/* ------------------------------------------------------------------ */
/* Final grades: entered by teachers, never computed here               */
/* ------------------------------------------------------------------ */

/** Workflow state of one subject-term; no row means draft. */
export const gradeSubmission = pgTable("grade_submission", {
  classSubjectId: text("class_subject_id")
    .primaryKey()
    .references(() => classSubject.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("draft"), // draft, submitted, approved, returned
  submittedBy: text("submitted_by").references(() => user.id, { onDelete: "set null" }),
  submittedAt: timestamptz("submitted_at"),
  decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
  decidedAt: timestamptz("decided_at"),
  returnNote: text("return_note"),
});

/** One learner's final grade in one subject-term (class_subject is per term). */
export const finalGrade = pgTable(
  "final_grade",
  {
    // Restrict: grades must not disappear when a class is deleted (DO 015 para. 61).
    classSubjectId: text("class_subject_id")
      .notNull()
      .references(() => classSubject.id, { onDelete: "restrict" }),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "restrict" }),
    grade: smallint("grade").notNull(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.classSubjectId, t.studentId] }),
    index("final_grade_student_idx").on(t.studentId),
    check("final_grade_range", sql`${t.grade} between 60 and 100`),
  ]
);

/** Append-only record of changes to grades. No foreign keys, so it outlives what it describes. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    at: timestamptz("at").notNull().defaultNow(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    detail: jsonb("detail"),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId)]
);

/** Tables better-auth's Drizzle adapter needs, keyed by model name. */
export const authSchema = { user, session, account, verification, rateLimit };
