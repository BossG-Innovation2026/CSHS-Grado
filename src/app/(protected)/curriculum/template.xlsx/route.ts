import { requireModule } from "@/lib/access";
import { buildWorkbook, XLSX_MIME } from "@/server/spreadsheet";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireModule("curriculum");
  const file = buildWorkbook("Subjects", [
    ["Code", "Title", "Terms", "Credit Units"],
    ["GEN-MATH", "General Mathematics", 3, 1],
    ["OC11", "Oral Communication", 1, 1],
  ]);
  return new Response(file, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": 'attachment; filename="subjects_template.xlsx"',
    },
  });
}
