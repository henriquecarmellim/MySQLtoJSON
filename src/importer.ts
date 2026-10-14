import { readFile } from "node:fs/promises";
import type { Connection } from "mysql2/promise";
import { buildInsertSQL, chunk, flattenRows, quoteIdent } from "./sql.js";

export interface ImportOptions {
  table?: string;
  truncate: boolean;
  mode: "insert" | "upsert";
  batchSize: number;
}

export interface ImportResult {
  table: string;
  inserted: number;
  batches: number;
}

interface DumpFile {
  tableName?: string;
  data: Record<string, unknown>[];
}

export function parseDump(raw: string): DumpFile {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid dump: not an object");
  if (!Array.isArray(parsed.data)) throw new Error("Invalid dump: 'data' must be an array");
  return parsed as DumpFile;
}

export async function importFile(
  conn: Connection,
  filePath: string,
  opts: ImportOptions,
): Promise<ImportResult> {
  const raw = await readFile(filePath, "utf8");
  const dump = parseDump(raw);

  const table = opts.table ?? dump.tableName;
  if (!table) {
    throw new Error(`Table name not found in dump and not provided via --table`);
  }

  if (dump.data.length === 0) {
    return { table, inserted: 0, batches: 0 };
  }

  const columns = Object.keys(dump.data[0]!);

  await conn.beginTransaction();
  try {
    if (opts.truncate) {
      await conn.query(`TRUNCATE TABLE ${quoteIdent(table)}`);
    }

    let inserted = 0;
    let batches = 0;
    for (const batch of chunk(dump.data, opts.batchSize)) {
      const sql = buildInsertSQL(table, columns, batch.length, opts.mode);
      const values = flattenRows(batch, columns);
      await conn.query(sql, values);
      inserted += batch.length;
      batches += 1;
    }

    await conn.commit();
    return { table, inserted, batches };
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}
