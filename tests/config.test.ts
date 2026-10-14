import { describe, it, expect } from "vitest";
import { configFromEnv, isComplete, mergeConfig } from "../src/config.js";

describe("configFromEnv", () => {
  it("reads MYSQL_* variables", () => {
    expect(
      configFromEnv({
        MYSQL_HOST: "db.example.com",
        MYSQL_PORT: "3306",
        MYSQL_USER: "root",
        MYSQL_PASSWORD: "secret",
        MYSQL_DATABASE: "app",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      host: "db.example.com",
      port: 3306,
      user: "root",
      password: "secret",
      database: "app",
    });
  });

  it("accepts empty string as password", () => {
    expect(configFromEnv({ MYSQL_PASSWORD: "" } as NodeJS.ProcessEnv)).toEqual({ password: "" });
  });

  it("ignores unset values", () => {
    expect(configFromEnv({} as NodeJS.ProcessEnv)).toEqual({});
  });
});

describe("mergeConfig", () => {
  it("overrides env with CLI flags", () => {
    const merged = mergeConfig(
      { host: "a", port: 3306, user: "root", password: "x", database: "db1" },
      { host: "b", database: "db2" },
    );
    expect(merged.host).toBe("b");
    expect(merged.database).toBe("db2");
    expect(merged.port).toBe(3306);
  });
});

describe("isComplete", () => {
  it("is false when fields are missing", () => {
    expect(isComplete({ host: "a" })).toBe(false);
  });

  it("is true when everything is set", () => {
    expect(
      isComplete({ host: "a", port: 3306, user: "u", password: "p", database: "d" }),
    ).toBe(true);
  });

  it("accepts empty-string password but not empty database", () => {
    expect(
      isComplete({ host: "a", port: 3306, user: "u", password: "", database: "d" }),
    ).toBe(true);
    expect(
      isComplete({ host: "a", port: 3306, user: "u", password: "", database: "" }),
    ).toBe(false);
  });
});
