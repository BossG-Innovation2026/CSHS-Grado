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
  index,
  integer,
  pgTable,
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
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("class_grade_name_uq").on(t.gradeLevelId, t.name),
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

/**
 * Students are not auth accounts: they have an LRN and personal information.
 * `birthDate` is an ISO date string (YYYY-MM-DD) so it prints and sorts the
 * same everywhere, without timezone surprises.
 */
export const student = pgTable(
  "student",
  {
    id: text("id").primaryKey(),
    lrn: text("lrn").notNull().unique(),
    surname: text("surname").notNull(),
    firstname: text("firstname").notNull(),
    middlename: text("middlename").notNull().default(""),
    sex: text("sex").notNull().default("M"),
    birthDate: text("birth_date").notNull().default(""),
    parentName: text("parent_name").notNull().default(""),
    parentContact: text("parent_contact").notNull().default(""),
    address: text("address").notNull().default(""),
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
/* Parent portal                                                       */
/* ------------------------------------------------------------------ */

/** Links a parent/guardian login to the student(s) they may view. */
export const parentLink = pgTable(
  "parent_link",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull().default("Parent"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("parent_link_user_student_uq").on(t.userId, t.studentId),
    index("parent_link_student_idx").on(t.studentId),
  ]
);

/* ------------------------------------------------------------------ */
/* Grades, verification and signed sheets                              */
/* ------------------------------------------------------------------ */

/** One grade per student, per subject offering (class_subject is per term). */
export const grade = pgTable(
  "grade",
  {
    id: text("id").primaryKey(),
    classSubjectId: text("class_subject_id")
      .notNull()
      .references(() => classSubject.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    /** DepEd scale 60–100; NULL means "not yet encoded". */
    value: integer("value"),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("grade_class_subject_student_uq").on(t.classSubjectId, t.studentId),
    index("grade_student_idx").on(t.studentId),
  ]
);

/**
 * Workflow for one class_subject (one subject, one term):
 * draft → submitted (subject teacher) → verified (adviser) →
 * approved (registrar) ; or returned with a note at any step.
 */
export const gradeSubmission = pgTable(
  "grade_submission",
  {
    id: text("id").primaryKey(),
    classSubjectId: text("class_subject_id")
      .notNull()
      .references(() => classSubject.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"),
    submittedBy: text("submitted_by").references(() => user.id, { onDelete: "set null" }),
    submittedAt: timestamptz("submitted_at"),
    adviserVerifiedBy: text("adviser_verified_by").references(() => user.id, {
      onDelete: "set null",
    }),
    adviserVerifiedAt: timestamptz("adviser_verified_at"),
    registrarVerifiedBy: text("registrar_verified_by").references(() => user.id, {
      onDelete: "set null",
    }),
    registrarVerifiedAt: timestamptz("registrar_verified_at"),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamptz("approved_at"),
    returnNote: text("return_note").notNull().default(""),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("grade_submission_class_subject_uq").on(t.classSubjectId)]
);

/**
 * Proof that the registrar office holds the teacher's signed grading sheet.
 * This is the paper backup used to double-check encoded grades.
 */
export const signedSheet = pgTable(
  "signed_sheet",
  {
    id: text("id").primaryKey(),
    classSubjectId: text("class_subject_id")
      .notNull()
      .references(() => classSubject.id, { onDelete: "cascade" }),
    referenceNo: text("reference_no").notNull().default(""),
    receivedBy: text("received_by").references(() => user.id, { onDelete: "set null" }),
    receivedAt: timestamptz("received_at").notNull().defaultNow(),
    note: text("note").notNull().default(""),
  },
  (t) => [index("signed_sheet_class_subject_idx").on(t.classSubjectId)]
);

/* ------------------------------------------------------------------ */
/* Academic records (JHS / Form 137)                                   */
/* ------------------------------------------------------------------ */

/**
 * A record from a previous school (junior high school, or a previous SHS).
 * `subjects` is a JSON array of { subject, grade } so a full JHS card can be
 * reproduced as the basis of the permanent record (Form 137).
 */
export const academicRecord = pgTable(
  "academic_record",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    schoolName: text("school_name").notNull().default(""),
    schoolYear: text("school_year").notNull().default(""),
    gradeLevel: text("grade_level").notNull().default(""),
    generalAverage: text("general_average").notNull().default(""),
    honors: text("honors").notNull().default(""),
    completed: boolean("completed").notNull().default(false),
    subjects: text("subjects").notNull().default("[]"),
    note: text("note").notNull().default(""),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("academic_record_student_idx").on(t.studentId)]
);

/**
 * Hand-over of a student's permanent record from the adviser to the
 * registrar (graduation, transfer or stop-out). The adviser surrenders;
 * the registrar confirms receipt.
 */
export const recordSurrender = pgTable(
  "record_surrender",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    classId: text("class_id").references(() => schoolClass.id, { onDelete: "set null" }),
    reason: text("reason").notNull().default("graduated"),
    status: text("status").notNull().default("pending"),
    surrenderedBy: text("surrendered_by").references(() => user.id, { onDelete: "set null" }),
    surrenderedAt: timestamptz("surrendered_at").notNull().defaultNow(),
    receivedBy: text("received_by").references(() => user.id, { onDelete: "set null" }),
    receivedAt: timestamptz("received_at"),
    note: text("note").notNull().default(""),
  },
  (t) => [
    index("record_surrender_student_idx").on(t.studentId),
    index("record_surrender_status_idx").on(t.status),
  ]
);

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

/** Append-only trail of who changed what, for the registrar and admins. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull().default(""),
    action: text("action").notNull(),
    entity: text("entity").notNull().default(""),
    entityId: text("entity_id").notNull().default(""),
    detail: text("detail").notNull().default(""),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt),
    index("audit_log_entity_idx").on(t.entity, t.entityId),
  ]
);

/** Tables better-auth's Drizzle adapter needs, keyed by model name. */
export const authSchema = { user, session, account, verification, rateLimit };
