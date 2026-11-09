"use client";

import { GradeEntryTable } from "@/components/grade-entry-table";
import type { SheetStudent, SubjectOffering } from "@/server/grades";

/** The full grade sheet page reuses the same editor as the teacher dashboard. */
export function GradeSheetForm({
  offering,
  students,
  canEncode,
}: {
  offering: SubjectOffering;
  students: SheetStudent[];
  canEncode: boolean;
}) {
  return <GradeEntryTable offering={offering} students={students} canEncode={canEncode} />;
}
