export function quoteIdent(name: string): string {
  if (!/^[A-Za-z0-9_$]+$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `\`${name}\``;
}

export function buildInsertSQL(
  table: string,
  columns: string[],
  rowCount: number,
  mode: "insert" | "upsert" = "insert",
): string {
  if (columns.length === 0) throw new Error("No columns");
  if (rowCount === 0) throw new Error("No rows");

  const cols = columns.map(quoteIdent).join(",");
  const rowPlaceholders = `(${columns.map(() => "?").join(",")})`;
  const values = Array.from({ length: rowCount }, () => rowPlaceholders).join(",");

  let sql = `INSERT INTO ${quoteIdent(table)} (${cols}) VALUES ${values}`;

  if (mode === "upsert") {
    const updates = columns.map((c) => `${quoteIdent(c)}=VALUES(${quoteIdent(c)})`).join(",");
    sql += ` ON DUPLICATE KEY UPDATE ${updates}`;
  }

  return sql;
}

export function flattenRows(rows: Record<string, unknown>[], columns: string[]): unknown[] {
  const out: unknown[] = [];
  for (const row of rows) {
    for (const col of columns) {
      out.push(row[col] ?? null);
    }
  }
  return out;
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error("Chunk size must be positive");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
