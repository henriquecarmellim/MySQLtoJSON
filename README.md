# MySQLtoJSON

[![CI](https://github.com/henriquecarmellim/MySQLtoJSON/actions/workflows/ci.yml/badge.svg)](https://github.com/henriquecarmellim/MySQLtoJSON/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/mysqltojson.svg)](https://www.npmjs.com/package/mysqltojson)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

Modern CLI to **export and import MySQL tables to and from JSON files** — with schema dump, batched inserts in transactions, env-var configuration, and an interactive fallback.

Written in TypeScript. Zero config to try out, scriptable in CI, safe by default.

---

## Highlights

- **Scriptable CLI** — explicit flags, exit codes, `--help`. No forced interactive menu.
- **Interactive fallback** — if you don't pass credentials, you get prompts (with masked password).
- **Dump everything** — `--all` exports every table in the database.
- **Schema included** — `--schema` writes `CREATE TABLE` as `<table>.schema.sql`.
- **Batched inserts in a transaction** — fast, atomic, with configurable batch size.
- **Upsert mode** — `--upsert` uses `ON DUPLICATE KEY UPDATE` so re-imports don't blow up on primary keys.
- **Env-var first** — `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` et al. No plaintext password file.
- **Tested** — unit tests for the SQL builders and config, plus a real-MySQL integration suite in CI.

---

## Install

```bash
npm install -g mysqltojson
# or run on-demand:
npx mysqltojson --help
```

---

## Quick start

```bash
# Export every table into ./backup
MYSQL_HOST=localhost MYSQL_USER=root MYSQL_PASSWORD=secret MYSQL_DATABASE=app \
  mysqltojson export --all --out ./backup --schema

# Re-import a single table, replacing its content
mysqltojson import ./backup/users.json --truncate

# Re-import an entire folder, upserting (safe to re-run)
mysqltojson import ./backup --all --upsert
```

If you don't pass credentials via flags or environment variables, the CLI prompts for them.

---

## Commands

### `export`

```
mysqltojson export [options]
```

| Option | Description |
|---|---|
| `-t, --table <names...>` | Specific table(s) to export |
| `-a, --all` | Export every table in the database |
| `-o, --out <dir>` | Output directory (default `./backup`) |
| `--schema` | Also dump `CREATE TABLE` as `<table>.schema.sql` |
| `--compact` | Write JSON without indentation |

Each exported file has the shape:

```json
{
  "tableName": "users",
  "exportedAt": "2026-10-14T12:00:00.000Z",
  "rowCount": 3,
  "data": [
    { "id": 1, "name": "Alice" }
  ]
}
```

### `import`

```
mysqltojson import <path> [options]
```

`<path>` is either a single `.json` file or a directory used with `--all`.

| Option | Description |
|---|---|
| `-t, --table <name>` | Override table name (single file only) |
| `-a, --all` | Import every `.json` file in the given directory |
| `--truncate` | `TRUNCATE` table before inserting |
| `--upsert` | Use `ON DUPLICATE KEY UPDATE` instead of plain `INSERT` |
| `--batch-size <n>` | Rows per `INSERT` batch (default `500`) |

Every import runs inside a transaction. On any error, nothing is committed.

### Connection options (both commands)

| Option | Env var |
|---|---|
| `-H, --host <host>` | `MYSQL_HOST` |
| `-P, --port <port>` | `MYSQL_PORT` |
| `-u, --user <user>` | `MYSQL_USER` |
| `-p, --password <password>` | `MYSQL_PASSWORD` |
| `-d, --database <database>` | `MYSQL_DATABASE` |

---

## Development

```bash
git clone https://github.com/henriquecarmellim/MySQLtoJSON.git
cd MySQLtoJSON
npm install

npm run dev -- export --all --out ./backup   # run the CLI from TS source
npm run build                                 # compile to dist/
npm test                                      # unit tests
```

### Integration tests against a real MySQL

Start one with Docker:

```bash
docker run -d --name mysqltojson-test \
  -e MYSQL_ROOT_PASSWORD=rootpw -e MYSQL_DATABASE=testdb \
  -p 3307:3306 mysql:8

MYSQL_TEST_HOST=127.0.0.1 MYSQL_TEST_PORT=3307 \
MYSQL_TEST_USER=root MYSQL_TEST_PASSWORD=rootpw MYSQL_TEST_DATABASE=testdb \
  npm test -- tests/integration.test.ts
```

The CI workflow (`.github/workflows/ci.yml`) runs the same suite on every push, against a MySQL 8 service container.

---

## License

ISC — see [LICENSE](LICENSE).
