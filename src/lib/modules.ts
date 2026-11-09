/**
 * Roles (who someone is) and modules (what they can open).
 *
 * - System Admin: configures everything (grade levels, subjects, classes,
 *   accounts) and always has every module.
 * - School Head: school-wide overview, analytics, grade approval.
 * - Department Head: classes assigned to them, grade approval.
 * - Registrar: student records and forms (SF9/SF10).
 * - Teacher: class adviser of classes they create (an adviser can also be a
 *   subject teacher); submits grades for the subjects they teach.
 * - Student / Parent: read-only access with a voucher code from the adviser
 *   (not a staff account; arrives with the grades module).
 *
 * Every staff account's modules stay configurable by a System Admin; the
 * role only decides the starting set (ROLE_DEFAULT_MODULES).
 */
export const ROLE_SYSTEM_ADMIN = "system_admin";
export const ROLE_SCHOOL_HEAD = "school_head";
export const ROLE_DEPARTMENT_HEAD = "department_head";
export const ROLE_REGISTRAR = "registrar";
export const ROLE_TEACHER = "teacher";
export const ROLE_PARENT = "parent";
/** Legacy role, kept so old rows still resolve to a label. */
export const ROLE_STUDENT = "student";

export const ROLE_LABELS: Record<string, string> = {
  [ROLE_SYSTEM_ADMIN]: "System Admin",
  [ROLE_SCHOOL_HEAD]: "School Head",
  [ROLE_DEPARTMENT_HEAD]: "Department Head",
  [ROLE_REGISTRAR]: "Registrar",
  [ROLE_TEACHER]: "Teacher",
  [ROLE_PARENT]: "Parent / Guardian",
  [ROLE_STUDENT]: "Student / Parent",
};

/** Roles in the order they appear in the account form. */
export const STAFF_ROLES = [
  ROLE_TEACHER,
  ROLE_DEPARTMENT_HEAD,
  ROLE_SCHOOL_HEAD,
  ROLE_REGISTRAR,
  ROLE_PARENT,
  ROLE_SYSTEM_ADMIN,
];

export const MODULES = [
  { key: "accounts", label: "Account Management" },
  { key: "curriculum", label: "Curriculum Setup (Grade Levels, Tracks, Subjects)" },
  { key: "classes", label: "Classes" },
  { key: "grades_submit", label: "Grade Submission" },
  { key: "grades_approve", label: "Grade Verification & Approval" },
  { key: "personal_info", label: "Personal Information" },
  { key: "academic_info", label: "Academic Information (JHS records & Form 137)" },
  { key: "registrar", label: "Registrar Office (records, forms, card printing)" },
  { key: "audit", label: "Audit Log" },
  { key: "parent_portal", label: "Parent Portal (my child's card)" },
  { key: "codes", label: "Student/Parent Access Codes" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

/** Starting modules when an account is created with a role (still editable). */
export const ROLE_DEFAULT_MODULES: Record<string, ModuleKey[]> = {
  [ROLE_TEACHER]: ["classes", "grades_submit", "grades_approve", "personal_info"],
  [ROLE_DEPARTMENT_HEAD]: ["classes", "grades_approve", "personal_info"],
  [ROLE_SCHOOL_HEAD]: ["classes", "curriculum", "grades_approve", "personal_info", "academic_info"],
  [ROLE_REGISTRAR]: ["classes", "registrar", "personal_info", "academic_info", "audit", "grades_approve"],
  [ROLE_PARENT]: ["parent_portal"],
  [ROLE_SYSTEM_ADMIN]: MODULES.map((m) => m.key),
};

export const NAV_LINKS: {
  module: ModuleKey;
  href: string;
  label: string;
  shortLabel: string;
  group: "main" | "grades" | "records" | "admin";
  implemented: boolean;
}[] = [
  { module: "classes", href: "/classes", label: "Classes", shortLabel: "Classes", group: "main", implemented: true },
  {
    module: "grades_submit",
    href: "/grades",
    label: "Grade Submission",
    shortLabel: "Submit grades",
    group: "grades",
    implemented: true,
  },
  {
    module: "grades_approve",
    href: "/grades/verify",
    label: "Grade Verification",
    shortLabel: "Verify grades",
    group: "grades",
    implemented: true,
  },
  {
    module: "personal_info",
    href: "/students",
    label: "Personal Information",
    shortLabel: "Personal info",
    group: "records",
    implemented: true,
  },
  {
    module: "academic_info",
    href: "/academic",
    label: "Academic Information",
    shortLabel: "Academic info",
    group: "records",
    implemented: true,
  },
  {
    module: "registrar",
    href: "/registrar",
    label: "Registrar Office",
    shortLabel: "Registrar",
    group: "records",
    implemented: true,
  },
  {
    module: "audit",
    href: "/audit",
    label: "Audit Log",
    shortLabel: "Audit log",
    group: "records",
    implemented: true,
  },
  {
    module: "parent_portal",
    href: "/parent",
    label: "My Child's Card",
    shortLabel: "My child",
    group: "main",
    implemented: true,
  },
  { module: "accounts", href: "/accounts", label: "Account Management", shortLabel: "Accounts", group: "admin", implemented: true },
  {
    module: "curriculum",
    href: "/curriculum",
    label: "Curriculum Setup",
    shortLabel: "Curriculum",
    group: "admin",
    implemented: true,
  },
  { module: "codes", href: "/codes", label: "Access Codes", shortLabel: "Codes", group: "admin", implemented: false },
];

export interface PermissionsLike {
  role: string;
  permissions?: string | null;
}

export function parsePermissions(raw: string | null | undefined): ModuleKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k) => MODULES.some((m) => m.key === k)) as ModuleKey[];
  } catch {
    return [];
  }
}

export function getPermissions(user: PermissionsLike): ModuleKey[] {
  if (user.role === ROLE_SYSTEM_ADMIN) return MODULES.map((m) => m.key);
  return parsePermissions(user.permissions);
}

export function can(user: PermissionsLike, module: ModuleKey): boolean {
  return getPermissions(user).includes(module);
}

/** System Admins configure the system: accounts, curriculum, every class. */
export function isAdmin(user: Pick<PermissionsLike, "role">): boolean {
  return user.role === ROLE_SYSTEM_ADMIN;
}

export function rolesCreatableBy(user: Pick<PermissionsLike, "role">): string[] {
  return isAdmin(user) ? STAFF_ROLES : [];
}
