"use client";

import { useActionState } from "react";
import { updateStudentPersonal, type StudentActionState } from "./actions";
import type { StudentRow } from "@/server/students";

const inputClass =
  "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none";

export function StudentInfoForm({ student }: { student: StudentRow }) {
  const [state, action, pending] = useActionState<StudentActionState, FormData>(updateStudentPersonal, {});

  return (
    <form action={action} className="space-y-4 p-4">
      <input type="hidden" name="studentId" value={student.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Surname</span>
          <input name="surname" required defaultValue={student.surname} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">First name</span>
          <input name="firstname" required defaultValue={student.firstname} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Middle name</span>
          <input name="middlename" defaultValue={student.middlename} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">LRN</span>
          <input value={student.lrn} disabled className={`${inputClass} bg-panel text-muted`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Sex</span>
          <select name="sex" defaultValue={student.sex} className={inputClass}>
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Date of birth</span>
          <input type="date" name="birthDate" defaultValue={student.birthDate} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Parent / guardian</span>
          <input name="parentName" defaultValue={student.parentName} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Parent contact</span>
          <input name="parentContact" defaultValue={student.parentContact} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">Address</span>
          <input name="address" defaultValue={student.address} className={inputClass} />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {state.error && <p className="text-rose-600 dark:text-rose-300">{state.error}</p>}
          {state.message && <p className="text-accent-strong">{state.message}</p>}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save personal information"}
        </button>
      </div>
    </form>
  );
}
