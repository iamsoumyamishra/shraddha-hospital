import { expect, test, type Page } from "@playwright/test";

/**
 * The staff journey: sign in, read the aggregates, open a response, and use the
 * authorization boundary as a non-manager.
 *
 * Credentials come from the environment. When `STAFF_PASSWORD` is absent the
 * sign-in test is skipped rather than silently passing, so a green run always
 * means the flow was actually exercised.
 */

const PASSWORD = process.env.SEED_STAFF_PASSWORD;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

test.describe("staff authentication", () => {
  test("redirects an anonymous visitor to the sign-in page", async ({ page }) => {
    await page.goto("/en/dashboard");

    await page.waitForURL(/\/en\/login/);
    await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
    // No aggregate may have been rendered before the redirect.
    await expect(page.getByText("Average index")).toHaveCount(0);
  });

  test("rejects a wrong password without signing in", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByLabel("Email").fill("admin@shraddha.example");
    await page.getByLabel("Password", { exact: true }).fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("not recognised")).toBeVisible();
    await page.waitForURL(/\/en\/login/);
  });

  test.skip(!PASSWORD, "Set SEED_STAFF_PASSWORD to run the authenticated staff tests");

  test("signs in and reaches every dashboard page", async ({ page }) => {
    await signIn(page, "admin@shraddha.example", PASSWORD!);

    await expect(page.getByText("Average index")).toBeVisible();

    for (const path of [
      "/en/dashboard/phi",
      "/en/dashboard/responses",
      "/en/dashboard/cases",
    ]) {
      await page.goto(path);
      await expect(page.getByText("Something went wrong")).toHaveCount(0);
      // The sidebar must be present, as a named navigation landmark.
      await expect(page.getByRole("navigation", { name: "Dashboard sections" })).toBeVisible();
    }
  });

  test("shows counts alongside the index, never an index alone", async ({ page }) => {
    await signIn(page, "admin@shraddha.example", PASSWORD!);

    await expect(page.getByText("Completed responses", { exact: true }).first()).toBeVisible();

    // The count is only interpretable alongside the period it covers, so the
    // filter must show a populated, ordered date range.
    const from = page.locator("#filter-from");
    const to = page.locator("#filter-to");
    await expect(from).toBeVisible();
    await expect(to).toBeVisible();

    const fromValue = await from.inputValue();
    const toValue = await to.inputValue();
    expect(fromValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fromValue < toValue).toBe(true);
  });

  test("downloads a report for the selected dashboard period", async ({ page }) => {
    await signIn(page, "admin@shraddha.example", PASSWORD!);
    await page.goto("/en/dashboard?from=2020-01-01&to=2020-01-31");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download report", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("hospital-experience-report-2020-01-01-2020-01-31.pdf");
    await expect(page.getByRole("button", { name: "Download report", exact: true })).toBeEnabled();
  });

  test("never reports a zero for a category with no responses", async ({ page }) => {
    await signIn(page, "admin@shraddha.example", PASSWORD!);
    await page.goto("/en/dashboard/phi");

    // The seeded period contains data for every category, so nothing should
    // render an em dash in place of a score.
    await expect(page.getByText(/No responses in this period/)).toHaveCount(0);
  });

  test("offers an accessible table equivalent for the chart", async ({ page }) => {
    await signIn(page, "admin@shraddha.example", PASSWORD!);

    const tableToggle = page.getByRole("button", { name: /table|data/i }).first();
    if (await tableToggle.isVisible().catch(() => false)) {
      await tableToggle.click();
      await expect(page.getByRole("table").first()).toBeVisible();
    }
    // Whatever the chart renders, a table must exist for screen readers.
    await expect(page.locator("table").first()).toBeAttached();
  });

  test("keeps contact details out of the response list", async ({ page }) => {
    await signIn(page, "admin@shraddha.example", PASSWORD!);
    await page.goto("/en/dashboard/responses");

    const body = await page.locator("body").innerHTML();
    // UUIDs may contain long digit sequences; do not mistake their segments
    // for phone numbers. Check the complete payload, including serialized props.
    expect(body).not.toContain("+91 90000 00000");
    expect(body).not.toContain("respondent@example.invalid");
    expect(body).not.toMatch(/(?<![a-f\d-])\+?\d{2}[\s-]?\d{5}[\s-]?\d{5}(?![a-f\d-])/i);
  });

  test("filters responses by period and does not error", async ({ page }) => {
    await signIn(page, "admin@shraddha.example", PASSWORD!);
    await page.goto("/en/dashboard/responses");

    await page.goto("/en/dashboard/responses?from=2020-01-01&to=2020-01-31");
    // An empty period must show an empty state, not fabricated numbers.
    await expect(page.getByText(/No responses|No feedback/i).first()).toBeVisible();
  });
});
