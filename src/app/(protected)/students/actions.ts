"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { isAdmin, ROLE_PARENT, ROLE_REGISTRAR } from "@/lib/modules";
import { recordAudit } from "@/server/audit";
import { userWithModule } from "@/server/guards";
import { canEditStudentInfo } from "@/server/students";

const { student, enrollment, schoolClass, user, parentLink, recordSurrender, academicRecord } = schema;

export interface StudentActionState {
  error?: string;
  message?: string;
  ok?: boolean;
}

function refreshStudent(studentId?: string) {
  revalidatePath("/students");
  revalidatePath("/academic");
  revalidatePath("/registrar");
  revalidatePath("/audit");
  if (studentId) {
    revalidatePath(`/students/${studentId}`);
    revalidatePath(`/academic/${studentId}`);
  }
}

/** Registrar office (or System Admin) only. */
async function registrarOffice() {
  const actor = await userWithModule("personal_info");
  if (!actor || !canEditStudentInfo(actor)) return null;
  return actor;
}

export async function updateStudentPersonal(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const actor = await registrarOffice();
  if (!actor) return { error: "Only the registrar office can edit personal information." };

  const id = String(formData.get("studentId") ?? "");
  const surname = String(formData.get("surname") ?? "").trim();
  const firstname = String(formData.get("firstname") ?? "").trim();
  const middlename = String(formData.get("middlename") ?? "").trim();
  const sex = String(formData.get("sex") ?? "").trim().toUpperCase();
  const birthDate = String(formData.get("birthDate") ?? "").trim();
  const parentName = String(formData.get("parentName") ?? "").trim();
  const parentContact = String(formData.get("parentContact") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!surname || !firstname) return { error: "Surname and first name are required." };
  if (sex !== "M" && sex !== "F") return { error: "Sex must be M or F." };
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return { error: "Date of birth must look like 2010-05-31." };
  }

  const updated = await getDb()
    .update(student)
    .set({ surname, firstname, middlename, sex, birthDate, parentName, parentContact, address })
    .where(eq(student.id, id))
    .returning({ id: student.id });
  if (updated.length === 0) return { error: "Student not found." };

  await recordAudit(actor, "student.update", "student", id, `${surname}, ${firstname}`);
  refreshStudent(id);
  return { ok: true, message: "Personal information saved." };
}

/** Link a parent/guardian account (created in Account Management) to this student. */
export async function linkParentAccount(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const actor = await registrarOffice();
  if (!actor) return { error: "Only the registrar office can grant parent access." };

  const studentId = String(formData.get("studentId") ?? "");
  const email = String(formData.get("parentEmail") ?? "").trim().toLowerCase();
  const relationship = String(formData.get("relationship") ?? "Parent").trim() || "Parent";
  if (!email) return { error: "Choose a parent account." };

  const [parent] = await getDb()
    .select({ id: user.id, name: user.name, role: user.role, active: user.active })
    .from(user)
    .where(and(eq(user.email, email), eq(user.role, ROLE_PARENT)))
    .limit(1);
  if (!parent) return { error: "No parent account with that email. Create one in Account Management first." };
  if (!parent.active) return { error: "That parent account is deactivated." };

  await getDb()
    .insert(parentLink)
    .values({ id: randomUUID(), userId: parent.id, studentId, relationship: relationship.slice(0, 40) })
    .onConflictDoUpdate({
      target: [parentLink.userId, parentLink.studentId],
      set: { relationship: relationship.slice(0, 40) },
    });

  await recordAudit(actor, "parent.link", "student", studentId, `${parent.name} <${email}> · ${relationship}`);
  refreshStudent(studentId);
  return { ok: true, message: `${parent.name} can now view this student's approved card.` };
}

export async function unlinkParent(_prev: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const actor = await registrarOffice();
  if (!actor) return { error: "Only the registrar office can remove parent access." };
  const linkId = String(formData.get("linkId") ?? "");
  const [link] = await getDb()
    .select({ studentId: parentLink.studentId, userId: parentLink.userId })
    .from(parentLink)
    .where(eq(parentLink.id, linkId))
    .limit(1);
  if (!link) return { error: "Parent link not found." };

  await getDb().delete(parentLink).where(eq(parentLink.id, linkId));
  await recordAudit(actor, "parent.unlink", "student", link.studentId, link.userId);
  refreshStudent(link.studentId);
  return { ok: true, message: "Parent access removed." };
}

/**
 * The class adviser hands the student's permanent record to the registrar
 * (graduation, transfer or stop-out). System Admins may do it too.
 */
export async function surrenderRecord(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const actor = await userWithModule("personal_info");
  if (!actor) return { error: "You do not have access to student records." };

  const studentId = String(formData.get("studentId") ?? "");
  const reason = String(formData.get("reason") ?? "graduated");
  if (!["graduated", "transferred", "stopped"].includes(reason)) return { error: "Choose a valid reason." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);

  const classes = await getDb()
    .select({ id: schoolClass.id, adviserId: schoolClass.adviserId, name: schoolClass.name })
    .from(enrollment)
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(eq(enrollment.studentId, studentId));
  if (classes.length === 0) return { error: "This student is not enrolled in a class." };
  const advised = classes.find((c) => c.adviserId === actor.id);
  if (!advised && !isAdmin(actor)) {
    return { error: "Only the class adviser (or a System Admin) can surrender this record." };
  }

  const [pending] = await getDb()
    .select({ id: recordSurrender.id })
    .from(recordSurrender)
    .where(and(eq(recordSurrender.studentId, studentId), eq(recordSurrender.status, "pending")))
    .limit(1);
  if (pending) return { error: "This record is already waiting for the registrar." };

  await getDb().insert(recordSurrender).values({
    id: randomUUID(),
    studentId,
    classId: advised?.id ?? classes[0].id,
    reason,
    status: "pending",
    surrenderedBy: actor.id,
    note,
  });

  await recordAudit(actor, "record.surrender", "student", studentId, `${reason} · ${advised?.name ?? classes[0].name}`);
  refreshStudent(studentId);
  return { ok: true, message: "Record surrendered. The registrar will confirm receipt." };
}

/** Registrar confirms that the permanent record is now in the registrar office. */
export async function receiveRecord(_prev: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const actor = await userWithModule("registrar");
  if (!actor) return { error: "Only the registrar office can receive records." };
  const id = String(formData.get("surrenderId") ?? "");
  const [row] = await getDb()
    .select({ studentId: recordSurrender.studentId, status: recordSurrender.status })
    .from(recordSurrender)
    .where(eq(recordSurrender.id, id))
    .limit(1);
  if (!row) return { error: "Record hand-over not found." };
  if (row.status !== "pending") return { error: "This record was already received." };

  await getDb()
    .update(recordSurrender)
    .set({ status: "received", receivedBy: actor.id, receivedAt: new Date() })
    .where(eq(recordSurrender.id, id));

  await recordAudit(actor, "record.receive", "student", row.studentId);
  refreshStudent(row.studentId);
  return { ok: true, message: "Record received and filed." };
}

function parseSubjects(raw: string): { subject: string; grade: string }[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const splitAt = line.includes("|") ? line.indexOf("|") : line.lastIndexOf(":");
      if (splitAt === -1) return { subject: line, grade: "" };
      return { subject: line.slice(0, splitAt).trim(), grade: line.slice(splitAt + 1).trim() };
    })
    .slice(0, 40);
}

/** Add a previous-school record (junior high school / earlier SHS). */
export async function addAcademicRecord(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const actor = await userWithModule("academic_info");
  if (!actor || (!isAdmin(actor) && actor.role !== ROLE_REGISTRAR)) {
    return { error: "Only the registrar office can edit academic records." };
  }
  const studentId = String(formData.get("studentId") ?? "");
  const schoolName = String(formData.get("schoolName") ?? "").trim();
  if (!schoolName) return { error: "School name is required." };

  const subjects = parseSubjects(String(formData.get("subjects") ?? ""));
  await getDb().insert(academicRecord).values({
    id: randomUUID(),
    studentId,
    schoolName: schoolName.slice(0, 160),
    schoolYear: String(formData.get("schoolYear") ?? "").trim().slice(0, 40),
    gradeLevel: String(formData.get("gradeLevel") ?? "").trim().slice(0, 40),
    generalAverage: String(formData.get("generalAverage") ?? "").trim().slice(0, 20),
    honors: String(formData.get("honors") ?? "").trim().slice(0, 80),
    completed: formData.get("completed") === "1",
    subjects: JSON.stringify(subjects),
    note: String(formData.get("note") ?? "").trim().slice(0, 300),
  });

  await recordAudit(actor, "academic.add", "student", studentId, schoolName);
  refreshStudent(studentId);
  return { ok: true, message: "Academic record added." };
}

export async function deleteAcademicRecord(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const actor = await userWithModule("academic_info");
  if (!actor || (!isAdmin(actor) && actor.role !== ROLE_REGISTRAR)) {
    return { error: "Only the registrar office can edit academic records." };
  }
  const id = String(formData.get("recordId") ?? "");
  const [row] = await getDb()
    .select({ studentId: academicRecord.studentId })
    .from(academicRecord)
    .where(eq(academicRecord.id, id))
    .limit(1);
  if (!row) return { error: "Record not found." };

  await getDb().delete(academicRecord).where(eq(academicRecord.id, id));
  await recordAudit(actor, "academic.delete", "student", row.studentId);
  refreshStudent(row.studentId);
  return { ok: true, message: "Academic record removed." };
}
