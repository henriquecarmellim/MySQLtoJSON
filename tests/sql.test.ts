import { describe, it, expect } from "vitest";
import { buildInsertSQL, chunk, flattenRows, quoteIdent } from "../src/sql.js";

describe("quoteIdent", () => {
  it("quotes a valid identifier with backticks", () => {
    expect(quoteIdent("users")).toBe("`users`");
    expect(quoteIdent("user_id")).toBe("`user_id`");
    expect(quoteIdent("col$1")).toBe("`col$1`");
  });

  it("rejects identifiers with backticks or quotes", () => {
    expect(() => quoteIdent("users`;--")).toThrow(/Invalid identifier/);
    expect(() => quoteIdent("a b")).toThrow(/Invalid identifier/);
    expect(() => quoteIdent("'users'")).toThrow(/Invalid identifier/);
  });
});

describe("buildInsertSQL", () => {
  it("builds a plain multi-row INSERT", () => {
    const sql = buildInsertSQL("users", ["id", "name"], 2);
    expect(sql).toBe("INSERT INTO `users` (`id`,`name`) VALUES (?,?),(?,?)");
  });

  it("builds an upsert with ON DUPLICATE KEY UPDATE", () => {
    const sql = buildInsertSQL("users", ["id", "name"], 1, "upsert");
    expect(sql).toBe(
      "INSERT INTO `users` (`id`,`name`) VALUES (?,?) ON DUPLICATE KEY UPDATE `id`=VALUES(`id`),`name`=VALUES(`name`)",
    );
  });

  it("rejects zero rows or zero columns", () => {
    expect(() => buildInsertSQL("x", [], 1)).toThrow();
    expect(() => buildInsertSQL("x", ["a"], 0)).toThrow();
  });
});

describe("flattenRows", () => {
  it("flattens rows preserving column order", () => {
    const rows = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ];
    expect(flattenRows(rows, ["id", "name"])).toEqual([1, "a", 2, "b"]);
  });

  it("fills missing columns with null", () => {
    const rows = [{ id: 1 }];
    expect(flattenRows(rows, ["id", "name"])).toEqual([1, null]);
  });
});

describe("chunk", () => {
  it("splits into equal batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("rejects non-positive size", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});
