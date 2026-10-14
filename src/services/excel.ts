import { EXAMPLE, validateDataset, type Dataset, type ValidationIssue } from "../domain/tsp/model";
export interface SheetData {
  name: string;
  rows: unknown[][];
}
export interface WorkbookData {
  sheets: SheetData[];
}
export interface ColumnMapping {
  id: number;
  x: number;
  y: number;
}
export async function readWorkbook(file: File): Promise<WorkbookData> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Gunakan file Excel .xlsx.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Ukuran file maksimum 10 MB.");
  const buffer = await file.arrayBuffer(),
    signature = new Uint8Array(buffer);
  if (signature[0] !== 0x50 || signature[1] !== 0x4b)
    throw new Error("Isi file bukan workbook .xlsx yang valid.");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", sheetRows: 1002 });
  for (const name of workbook.SheetNames) {
    const fullRange = workbook.Sheets[name]?.["!fullref"];
    if (fullRange && XLSX.utils.decode_range(fullRange).e.r >= 1002)
      throw new Error(
        `Sheet ${name} melebihi 1.001 baris data/blank. Rapikan workbook; preview tidak akan memotong data diam-diam.`,
      );
  }
  const sheets = workbook.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name]!, {
      header: 1,
      defval: "",
      blankrows: true,
    }),
  }));
  if (!sheets.some((sheet) => sheet.rows.length > 1))
    throw new Error("Workbook tidak berisi tabel data.");
  return { sheets };
}
export function guessColumns(sheet: SheetData): ColumnMapping {
  const headers = (sheet.rows[0] ?? []).map((cell) => String(cell).trim().toLowerCase());
  return { id: headers.indexOf("id"), x: headers.indexOf("x"), y: headers.indexOf("y") };
}
export function previewSheet(
  sheet: SheetData,
  mapping: ColumnMapping,
): { dataset: Dataset; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (
    Object.values(mapping).some((index) => index < 0) ||
    new Set(Object.values(mapping)).size !== 3
  )
    return {
      dataset: { ...emptyDataset(), nodes: [] },
      issues: [{ message: "Pilih tiga kolom berbeda untuk ID, X, dan Y." }],
    };
  const rows = sheet.rows
    .slice(1)
    .map((cells, row) => ({ cells, row }))
    .filter(({ cells }) => cells.some((cell) => String(cell ?? "").trim() !== ""));
  const dataset: Dataset = {
    ...emptyDataset(),
    name: `Impor · ${sheet.name}`,
    nodes: rows.map(({ cells }) => ({
      id: String(cells[mapping.id] ?? "").trim(),
      x: parseNumber(cells[mapping.x]),
      y: parseNumber(cells[mapping.y]),
    })),
  };
  for (const issue of validateDataset(dataset))
    issues.push({ ...issue, row: issue.row === undefined ? undefined : rows[issue.row]!.row + 2 });
  return { dataset, issues };
}
function parseNumber(cell: unknown): number {
  return typeof cell === "number"
    ? cell
    : typeof cell === "string" && cell.trim() !== ""
      ? Number(cell)
      : NaN;
}
function emptyDataset(): Dataset {
  return {
    id: "import",
    name: "Impor Excel",
    unit: "unit koordinat",
    provenance: "Koordinat planar dari Excel yang diimpor pengguna.",
    nodes: [],
  };
}
export async function downloadTemplate() {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(EXAMPLE.nodes), "Nodes");
  XLSX.writeFile(workbook, "heurilab-template.xlsx");
}
