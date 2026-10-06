import { describe, expect, it } from "vitest";
import { databaseUrl } from "@/lib/database-url";

describe("database deployment configuration", () => {
  it("uses integration-managed Neon credentials instead of an obsolete manual URL", () => {
    const environment = { DATABASE_URL: "postgresql://old/db", STORAGE_DATABASE_URL: "postgresql://pooled/db", STORAGE_DATABASE_URL_UNPOOLED: "postgresql://direct/db" };
    expect(databaseUrl(environment)).toBe(environment.STORAGE_DATABASE_URL);
    expect(databaseUrl(environment, "migration")).toBe(environment.STORAGE_DATABASE_URL_UNPOOLED);
  });
  it("supports local PostgreSQL and integrations without a direct URL", () => {
    expect(databaseUrl({ DATABASE_URL: "postgresql://local/db" }, "migration")).toBe("postgresql://local/db");
    expect(databaseUrl({ STORAGE_DATABASE_URL: "postgresql://pooled/db" }, "migration")).toBe("postgresql://pooled/db");
  });
  it("fails without a database connection", () => {
    expect(() => databaseUrl({})).toThrow("DATABASE_URL or STORAGE_DATABASE_URL is required");
  });
});
