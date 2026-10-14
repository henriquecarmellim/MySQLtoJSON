import { describe, it, expect } from "vitest";
import { parseDump } from "../src/importer.js";

describe("parseDump", () => {
  it("accepts a well-formed dump", () => {
    const dump = parseDump(
      JSON.stringify({ tableName: "users", data: [{ id: 1 }] }),
    );
    expect(dump.tableName).toBe("users");
    expect(dump.data).toEqual([{ id: 1 }]);
  });

  it("rejects a dump without data array", () => {
    expect(() => parseDump('{"tableName":"x"}')).toThrow(/data.*array/);
  });

  it("rejects non-object JSON", () => {
    expect(() => parseDump("[]")).toThrow();
    expect(() => parseDump("null")).toThrow();
  });
});
