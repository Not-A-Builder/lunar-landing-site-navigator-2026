/** CSV export helpers (RFC 4180 quoting) shared by the site details downloads (D-103). */

export type CsvCell = string | number | null | undefined;

/** Quotes a cell when it holds a comma, quote or line break; empty for null / undefined. */
export function csvCell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/** Saves the text as a CSV file in the browser. */
export function downloadCsv(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const el = document.createElement("a");
  el.href = url;
  el.download = filename;
  el.click();
  URL.revokeObjectURL(url);
}
