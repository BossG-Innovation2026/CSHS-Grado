import { requireModule } from "@/lib/access";
import { getGradeSheet } from "@/server/grades";
import { buildWorkbook, XLSX_MIME } from "@/server/spreadsheet";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireModule("grades_submit");
  const { id } = await params;
  const sheet = await getGradeSheet(id);
  if (!sheet) return new Response("Not found", { status: 404 });

  const rows = sheet.students.map((learner) => [
    learner.lrn,
    learner.surname,
    learner.firstname,
    sheet.grades[learner.id] ?? "",
  ]);
  const file = buildWorkbook("Final Grades", [["LRN", "Surname", "Firstname", "Final Grade"], ...rows]);
  const name = `${sheet.code}-term${sheet.term}`.replace(/[^A-Za-z0-9-]/g, "_");
  return new Response(file, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${name}-final-grades.xlsx"`,
    },
  });
}
