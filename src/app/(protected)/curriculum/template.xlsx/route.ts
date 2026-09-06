import { requireModule } from "@/lib/access";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireModule("curriculum");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Code", "Title", "Terms"],
    ["GEN-MATH", "General Mathematics", 3],
    ["OC11", "Oral Communication", 1],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Subjects");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="subjects_template.xlsx"',
    },
  });
}
