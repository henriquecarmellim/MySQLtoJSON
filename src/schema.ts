import type { Connection, RowDataPacket } from "mysql2/promise";
import { quoteIdent } from "./sql.js";

export async function listTables(conn: Connection, database: string): Promise<string[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
    [database],
  );
  return rows.map((r) => r.name as string);
}

export async function dumpCreateTable(conn: Connection, table: string): Promise<string> {
  const [rows] = await conn.query<RowDataPacket[]>(`SHOW CREATE TABLE ${quoteIdent(table)}`);
  const row = rows[0];
  if (!row) throw new Error(`Table not found: ${table}`);
  return (row["Create Table"] ?? row["Create View"]) as string;
}

export async function countRows(conn: Connection, table: string): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM ${quoteIdent(table)}`,
  );
  return Number(rows[0]?.n ?? 0);
}
