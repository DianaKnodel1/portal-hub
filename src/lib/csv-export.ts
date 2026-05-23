export function exportToCsv(filename: string, rows: Record<string, any>[], columns: { key: string; label: string }[]) {
  const header = columns.map((c) => c.label).join(";");
  const body = rows.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      if (val == null) return "";
      const str = String(val).replace(/"/g, '""');
      return str.includes(";") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
    }).join(";")
  ).join("\n");
  const blob = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
