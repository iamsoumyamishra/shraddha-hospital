import "dotenv/config";
import { execFileSync } from "node:child_process";

/**
 * Integration tests run against the separate test database, never the dev one.
 *
 * `src/lib/db.ts` reads DATABASE_URL lazily, so pointing DATABASE_URL at
 * TEST_DATABASE_URL here means every module under test picks up the test
 * database on its first call.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not set. Integration tests will not run against the dev database.");
}

if ([process.env.DATABASE_URL, process.env.STORAGE_DATABASE_URL, process.env.STORAGE_DATABASE_URL_UNPOOLED].includes(testDatabaseUrl)) {
  throw new Error(
    "TEST_DATABASE_URL and DATABASE_URL are the same. Refusing to run integration tests against the development database.",
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
// Never let a Vercel integration override the isolated test database.
delete process.env.STORAGE_DATABASE_URL;
delete process.env.STORAGE_DATABASE_URL_UNPOOLED;
// Fixtures create their own synthetic hospitals; local deployment scope must
// not filter those fixtures out of the public-survey loader.
process.env.PUBLIC_SURVEY_HOSPITAL_SLUG = "";

// Migrations are applied once per test run, outside the per-file hooks.
execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "pipe",
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});

export {};
