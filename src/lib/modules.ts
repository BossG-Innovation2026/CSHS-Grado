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
export const ROLE_STUDENT = "student";

export const ROLE_LABELS: Record<string, string> = {
  [ROLE_SYSTEM_ADMIN]: "System Admin",
  [ROLE_SCHOOL_HEAD]: "School Head",
  [ROLE_DEPARTMENT_HEAD]: "Department Head",
  [ROLE_REGISTRAR]: "Registrar",
  [ROLE_TEACHER]: "Teacher",
  [ROLE_STUDENT]: "Student / Parent",
};

/** Staff roles, in the order they appear in the account form. */
export const STAFF_ROLES = [
  ROLE_TEACHER,
  ROLE_DEPARTMENT_HEAD,
  ROLE_SCHOOL_HEAD,
  ROLE_REGISTRAR,
  ROLE_SYSTEM_ADMIN,
];

export const MODULES = [
  { key: "accounts", label: "Account Management" },
  { key: "curriculum", label: "Curriculum Setup (Grade Levels, Tracks, Subjects)" },
  { key: "classes", label: "Classes" },
  { key: "grades_submit", label: "Grade Submission" },
  { key: "grades_approve", label: "Grades Approval & Analytics" },
  { key: "registrar", label: "Records & Forms (SF9/SF10)" },
  { key: "codes", label: "Student/Parent Access Codes" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

/** Starting modules when an account is created with a role (still editable). */
export const ROLE_DEFAULT_MODULES: Record<string, ModuleKey[]> = {
  [ROLE_TEACHER]: ["classes", "grades_submit", "codes"],
  [ROLE_DEPARTMENT_HEAD]: ["classes", "grades_approve"],
  [ROLE_SCHOOL_HEAD]: ["classes", "curriculum", "grades_approve"],
  [ROLE_REGISTRAR]: ["classes", "registrar"],
  [ROLE_SYSTEM_ADMIN]: MODULES.map((m) => m.key),
};

export const NAV_LINKS: {
  module: ModuleKey;
  href: string;
  label: string;
  implemented: boolean;
}[] = [
  { module: "accounts", href: "/accounts", label: "Account Management", implemented: true },
  { module: "accounts", href: "/settings/school-year", label: "School Years", implemented: true },
  { module: "curriculum", href: "/curriculum", label: "Curriculum Setup", implemented: true },
  { module: "classes", href: "/classes", label: "Classes", implemented: true },
  { module: "grades_submit", href: "/grades", label: "Grade Submission", implemented: false },
  { module: "grades_approve", href: "/grades/approval", label: "Grades Approval", implemented: false },
  { module: "registrar", href: "/registrar", label: "Records & Forms", implemented: false },
  { module: "codes", href: "/codes", label: "Access Codes", implemented: false },
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
