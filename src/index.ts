#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Command } from "commander";
import mysql from "mysql2/promise";
import {
  type ConfigOverrides,
  configFromEnv,
  isComplete,
  mergeConfig,
  promptMissing,
} from "./config.js";
import { exportTable } from "./exporter.js";
import { importFile } from "./importer.js";
import { listTables } from "./schema.js";

const program = new Command();

program
  .name("mysqltojson")
  .description("Export and import MySQL tables to and from JSON files.")
  .version("2.0.0");

function connectionOptions(cmd: Command) {
  return cmd
    .option("-H, --host <host>", "MySQL host (env: MYSQL_HOST)")
    .option("-P, --port <port>", "MySQL port (env: MYSQL_PORT)", (v) => Number(v))
    .option("-u, --user <user>", "MySQL user (env: MYSQL_USER)")
    .option("-p, --password <password>", "MySQL password (env: MYSQL_PASSWORD)")
    .option("-d, --database <database>", "MySQL database (env: MYSQL_DATABASE)");
}

async function connect(opts: ConfigOverrides) {
  const env = configFromEnv();
  const merged = mergeConfig(env, opts);
  const cfg = isComplete(merged) ? merged : await promptMissing(merged);
  return mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    multipleStatements: false,
    dateStrings: true,
  });
}

connectionOptions(program.command("export"))
  .description("Export one or more tables to JSON files")
  .option("-t, --table <names...>", "Specific table(s) to export")
  .option("-a, --all", "Export every table in the database")
  .option("-o, --out <dir>", "Output directory", "./backup")
  .option("--schema", "Also dump CREATE TABLE as <table>.schema.sql", false)
  .option("--compact", "Write compact JSON (no indentation)", false)
  .action(async (opts) => {
    const conn = await connect(opts);
    try {
      let tables: string[] = opts.table ?? [];
      if (opts.all) {
        tables = await listTables(conn, opts.database ?? process.env.MYSQL_DATABASE ?? "");
      }
      if (tables.length === 0) {
        throw new Error("No table specified. Use --table <name> or --all.");
      }

      for (const table of tables) {
        const r = await exportTable(conn, table, {
          outDir: resolve(opts.out),
          includeSchema: Boolean(opts.schema),
          pretty: !opts.compact,
        });
        process.stdout.write(
          `[export] ${r.table}: ${r.rows} rows -> ${r.file}${r.schemaFile ? `, ${r.schemaFile}` : ""}\n`,
        );
      }
    } finally {
      await conn.end();
    }
  });

connectionOptions(program.command("import"))
  .description("Import JSON dump(s) back into MySQL")
  .argument("<path>", "JSON file or directory containing dumps")
  .option("-t, --table <name>", "Override table name (single file only)")
  .option("-a, --all", "Import every .json file in the given directory")
  .option("--truncate", "TRUNCATE table before inserting", false)
  .option("--upsert", "Use ON DUPLICATE KEY UPDATE instead of plain INSERT", false)
  .option("--batch-size <n>", "Rows per INSERT batch", (v) => Number(v), 500)
  .action(async (path, opts) => {
    const conn = await connect(opts);
    try {
      const files = await resolveFiles(path, Boolean(opts.all));
      const mode = opts.upsert ? "upsert" : "insert";

      for (const file of files) {
        const r = await importFile(conn, file, {
          table: opts.table,
          truncate: Boolean(opts.truncate),
          mode,
          batchSize: opts.batchSize,
        });
        process.stdout.write(
          `[import] ${r.table}: ${r.inserted} rows in ${r.batches} batch(es) from ${file}\n`,
        );
      }
    } finally {
      await conn.end();
    }
  });

async function resolveFiles(path: string, all: boolean): Promise<string[]> {
  const abs = resolve(path);
  if (all) {
    const entries = await readdir(abs, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => join(abs, e.name))
      .sort();
  }
  return [abs];
}

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
