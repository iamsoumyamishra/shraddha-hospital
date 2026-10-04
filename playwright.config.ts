import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const port = new URL(baseURL).port || "3100";

/**
 * End-to-end coverage for the two journeys that matter most: a patient
 * submitting the survey without an account, and staff reading the results.
 *
 * A dedicated port and the production build are used deliberately, so the test
 * exercises the same server-rendered output a real deployment serves.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // The patient survey is mobile-first, so the primary viewport is a phone.
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: /patient\.spec\.ts/,
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm exec next start -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        env: {
          // Must match the origin the browser will actually use. Better Auth
          // rejects a mismatched Origin header with 403 before it ever looks
          // at the password, so leaving this at the development port makes
          // every sign-in fail for a reason unrelated to the credentials.
          BETTER_AUTH_URL: baseURL,
          // One machine signs in repeatedly, which trips the 3-per-minute
          // credential throttle that protects real users.
          AUTH_RATE_LIMIT_MAX: "500",
          SEED_STAFF_PASSWORD: process.env.SEED_STAFF_PASSWORD ?? "",
        },
      },
});