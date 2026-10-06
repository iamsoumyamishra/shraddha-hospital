import { expect, test } from "@playwright/test";

for (const [locale, name, privacyLabel] of [
  ["hi", "हिन्दी", "मैंने ऊपर दी गई सूचना पढ़ ली है।"],
  ["mr", "मराठी", "मी वरील सूचना वाचली आहे."],
] as const) {
  test(`starts feedback in ${locale} after the initial language choice`, async ({ page }) => {
    await page.goto("/en/feedback/outpatient-experience");
    const option = page.getByRole("radio", { name, exact: true });
    test.skip(await option.count() === 0, "Requires isolated reviewed survey fixtures.");
    await expect(page.getByLabel("I have read the notice above.")).toHaveCount(0);
    await option.click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/feedback/`));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByLabel(privacyLabel)).toBeVisible();
    expect(new URL(page.url()).searchParams.get("version")).toMatch(/^[0-9a-f-]{36}$/);
  });
}

test("employee and login pages stay English after patient language changes", async ({ page }) => {
  await page.goto("/hi");
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page.goto("/mr/login");
  await expect(page).toHaveURL(/\/en\/login$/);
  await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
});

test("language switching preserves the complete draft, version and retry key", async ({ page }) => {
  await page.goto("/en/feedback/outpatient-experience");
  await page.getByRole("radio", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
  const language = page.getByRole("combobox", { name: "Language", exact: true });
  const available = await language.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  test.skip(!available.includes("hi") || !available.includes("mr"), "Requires isolated reviewed localization fixtures; production drafts stay unpublished.");
  await page.getByLabel("I have read the notice above.").click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Reception and registration", { exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const firstRating = page.locator("fieldset").first().getByRole("radio", { name: "4 — Satisfied", exact: true });
  await firstRating.click();
  const firstQuestionId = (await firstRating.getAttribute("id"))!.replace(/-4$/, "");
  await language.selectOption("hi");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByText(/^5 में से चरण 3/)).toBeVisible();
  await page.getByRole("button", { name: "पीछे", exact: true }).click();
  await expect(page.getByLabel("स्वागत और पंजीकरण", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "पीछे", exact: true }).click();
  await expect(page.getByLabel("मैंने ऊपर दी गई सूचना पढ़ ली है।")).toBeChecked();
  await page.getByRole("button", { name: "आगे", exact: true }).click();
  await page.getByRole("button", { name: "आगे", exact: true }).click();
  await expect(page.locator("fieldset").first().getByRole("radio", { name: "4 — संतुष्ट", exact: true })).toBeChecked();
  const version = new URL(page.url()).searchParams.get("version");
  expect(version).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByRole("combobox", { name: "भाषा", exact: true }).selectOption("mr");
  await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  expect(new URL(page.url()).searchParams.get("version")).toBe(version);
  await expect(page.locator("fieldset").first().getByRole("radio", { name: "4 — समाधानी", exact: true })).toBeChecked();
  for (const fieldset of await page.locator("fieldset").all()) await fieldset.getByRole("radio", { name: "4 — समाधानी", exact: true }).click();
  await page.getByRole("button", { name: "पुढे", exact: true }).click();
  await page.getByRole("radio", { name: "समाधानी", exact: true }).click();
  await page.locator("textarea").fill("Synthetic multilingual browser feedback");
  await page.getByRole("button", { name: "पुढे", exact: true }).click();
  await page.getByLabel("माझ्या अभिप्रायाबाबत संपर्क साधण्यास मी संमती देतो/देते.").click();
  await page.getByLabel("नाव", { exact: true }).fill("Synthetic contact");
  await page.getByLabel("ईमेल", { exact: true }).fill("synthetic@example.test");
  await page.getByRole("combobox", { name: "भाषा", exact: true }).selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText(/^Step 5 of 5/)).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Synthetic contact");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("synthetic@example.test");
  const payloads: Array<Record<string, unknown>> = [];
  await page.route("**/api/feedback/submit", async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({ status: payloads.length === 1 ? 503 : 201, contentType: "application/json", body: payloads.length === 1 ? '{"error":"server_error"}' : JSON.stringify({ publicId: "synthetic-browser-reference", status: "COMPLETE", patientIndex: 75, displayDecimals: 1 }) });
  });
  await page.getByRole("button", { name: "Submit feedback", exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toContainText("We could not record your feedback");
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("hi");
  await expect(page.locator('main [role="alert"]')).toContainText("हम आपका फीडबैक दर्ज नहीं कर सके");
  await page.getByRole("button", { name: "फीडबैक भेजें", exact: true }).click();
  await expect(page.getByText("अपनी प्रतिक्रिया भेजने के लिए धन्यवाद।", { exact: true })).toBeVisible();
  expect(payloads[0]!.idempotencyKey).toBe(payloads[1]!.idempotencyKey);
  expect(payloads[1]!.locale).toBe("hi");
  expect(payloads[1]!.surveyVersionId).toBe(version);
  expect(payloads[1]!.answers).toEqual(payloads[0]!.answers);
  expect(payloads[1]!.comment).toBe("Synthetic multilingual browser feedback");
  expect(payloads[1]!.servicesUsed).toEqual(["reception"]);
  expect(payloads[1]!.followUpConsent).toEqual({ consentGiven: true, contact: { displayName: "Synthetic contact", email: "synthetic@example.test" } });
  // The stable first question ID remains present through both language changes.
  expect(JSON.stringify(payloads[1]!.answers)).toContain(firstQuestionId);
  await expect(page.locator('main [role="status"]')).toHaveText("अपनी प्रतिक्रिया भेजने के लिए धन्यवाद।");
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.getByText("75.0", { exact: true })).toHaveCount(0);
  expect(page.url()).not.toContain("synthetic@example");
});
