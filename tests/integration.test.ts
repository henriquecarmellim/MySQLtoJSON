import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportTable } from "../src/exporter.js";
import { importFile } from "../src/importer.js";
import { listTables } from "../src/schema.js";

const SKIP = process.env.MYSQL_TEST_HOST === undefined;

const d = SKIP ? describe.skip : describe;

d("integration against real MySQL", () => {
  let conn: mysql.Connection;
  let workDir: string;

  beforeAll(async () => {
    conn = await mysql.createConnection({
      host: process.env.MYSQL_TEST_HOST!,
      port: Number(process.env.MYSQL_TEST_PORT ?? 3306),
      user: process.env.MYSQL_TEST_USER ?? "root",
      password: process.env.MYSQL_TEST_PASSWORD ?? "",
      database: process.env.MYSQL_TEST_DATABASE ?? "testdb",
      multipleStatements: true,
      dateStrings: true,
    });

    await conn.query("DROP TABLE IF EXISTS it_users");
    await conn.query(
      "CREATE TABLE it_users (id INT PRIMARY KEY, name VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL)",
    );
    await conn.query(
      "INSERT INTO it_users (id, name, created_at) VALUES (1, 'Alice', '2026-01-01 10:00:00'), (2, 'Bob', '2026-01-02 11:00:00'), (3, 'Carol', '2026-01-03 12:00:00')",
    );

    workDir = await mkdtemp(join(tmpdir(), "mysqltojson-"));
  });

  afterAll(async () => {
    if (conn) {
      await conn.query("DROP TABLE IF EXISTS it_users");
      await conn.end();
    }
    if (workDir) await rm(workDir, { recursive: true, force: true });
  });

  it("lists the test table", async () => {
    const tables = await listTables(conn, process.env.MYSQL_TEST_DATABASE ?? "testdb");
    expect(tables).toContain("it_users");
  });

  it("exports and reimports a table (round-trip with --truncate)", async () => {
    const result = await exportTable(conn, "it_users", {
      outDir: workDir,
      includeSchema: true,
      pretty: true,
    });
    expect(result.rows).toBe(3);

    const raw = await readFile(result.file, "utf8");
    const dump = JSON.parse(raw);
    expect(dump.tableName).toBe("it_users");
    expect(dump.data).toHaveLength(3);
    expect(dump.data[0].name).toBe("Alice");

    const imp = await importFile(conn, result.file, {
      truncate: true,
      mode: "insert",
      batchSize: 2,
    });
    expect(imp.inserted).toBe(3);
    expect(imp.batches).toBe(2);

    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM it_users",
    );
    expect(Number(rows[0]!.n)).toBe(3);
  });

  it("upsert mode updates existing rows without failing on primary key", async () => {
    const dumpPath = join(workDir, "it_users.json");
    const dump = {
      tableName: "it_users",
      data: [
        { id: 1, name: "Alice-updated", created_at: "2026-01-01 10:00:00" },
        { id: 4, name: "Dave", created_at: "2026-01-04 13:00:00" },
      ],
    };
    const { writeFile } = await import("node:fs/promises");
    await writeFile(dumpPath, JSON.stringify(dump), "utf8");

    const imp = await importFile(conn, dumpPath, {
      truncate: false,
      mode: "upsert",
      batchSize: 500,
    });
    expect(imp.inserted).toBe(2);

    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT name FROM it_users WHERE id = 1",
    );
    expect(rows[0]!.name).toBe("Alice-updated");
  });
});
