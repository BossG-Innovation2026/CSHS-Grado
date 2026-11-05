import "server-only";
import * as XLSX from "xlsx";

/** Largest upload we parse (Workers have tight CPU/memory budgets). */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** Largest number of data rows accepted per upload. */
export const MAX_UPLOAD_ROWS = 2000;

export type SheetRow = Record<string, unknown>;

/** Read the first sheet of an uploaded .xlsx/.xls/.csv file as row objects keyed by header. */
export async function readFirstSheet(file: File): Promise<{ rows: SheetRow[] } | { error: string }> {
  if (file.size === 0) return { error: "The file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "The file is too large (limit 2 MB)." };
  let rows: SheetRow[];
  try {
    const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return { error: "The file has no sheets." };
    rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "" });
  } catch {
    return { error: "The file could not be read. Upload the Excel template." };
  }
  if (rows.length === 0) return { error: "The file is empty." };
  if (rows.length > MAX_UPLOAD_ROWS) {
    return { error: `Too many rows (${rows.length}). Upload at most ${MAX_UPLOAD_ROWS} at a time.` };
  }
  return { rows };
}

/** Read a cell by any of the given header names, as trimmed text. */
export function cell(row: SheetRow, ...names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

/** Build an .xlsx file from rows (first row = header). */
export function buildWorkbook(sheetName: string, rows: (string | number)[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Split an array into chunks (keeps bulk INSERTs under Postgres' parameter limit). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
