import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { quoteIdent } from "./sql.js";
import { countRows, dumpCreateTable } from "./schema.js";

export interface ExportOptions {
  outDir: string;
  includeSchema: boolean;
  pretty: boolean;
}

export interface ExportResult {
  table: string;
  rows: number;
  file: string;
  schemaFile?: string;
}

export async function exportTable(
  conn: Connection,
  table: string,
  opts: ExportOptions,
): Promise<ExportResult> {
  const total = await countRows(conn, table);

  const file = join(opts.outDir, `${table}.json`);
  await mkdir(dirname(file), { recursive: true });

  const [rows] = await conn.query<RowDataPacket[]>(`SELECT * FROM ${quoteIdent(table)}`);

  const payload = {
    tableName: table,
    exportedAt: new Date().toISOString(),
    rowCount: total,
    data: rows,
  };
  await writeFile(file, JSON.stringify(payload, null, opts.pretty ? 2 : 0), "utf8");

  let schemaFile: string | undefined;
  if (opts.includeSchema) {
    const ddl = await dumpCreateTable(conn, table);
    schemaFile = join(opts.outDir, `${table}.schema.sql`);
    await writeFile(schemaFile, ddl + ";\n", "utf8");
  }

  return { table, rows: total, file, schemaFile };
}
