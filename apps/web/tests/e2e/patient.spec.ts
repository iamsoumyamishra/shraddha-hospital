import { expect, test, type Page } from "@playwright/test";

/**
 * The patient journey, on a phone-sized viewport: privacy notice, services,
 * 15 ratings, review, submit, confirmation. No account is involved anywhere.
 */

const SURVEY_PATH = "/en/feedback/outpatient-experience";

/**
 * The form's validation message. Scoped to `main` because Next.js injects its
 * own `__next-route-announcer__` element with `role="alert"`, which would
 * otherwise make `getByRole("alert")` ambiguous.
 */
function formAlert(page: Page) {
  return page.locator('main [role="alert"]');
}

/** Fills the 15-question step. Ratings default to 4; `notApplicable` opts out. */
async function answerAllQuestions(page: Page, options: { notApplicable?: number[] } = {}) {
  const notApplicable = new Set(options.notApplicable ?? []);

  // On this step every fieldset is one question, so the count is the contract.
  const fieldsets = page.locator("fieldset");
  await expect(fieldsets).toHaveCount(15);

  for (let index = 0; index < 15; index += 1) {
    const fieldset = fieldsets.nth(index);
    if (notApplicable.has(index)) {
      await fieldset.getByRole("radio", { name: "Not applicable" }).click();
    } else {
      await fieldset.getByRole("radio", { name: "4 — Satisfied" }).click();
    }
  }
}

async function completePrivacyAndServices(page: Page) {
  await expect(page.getByText("Step 1 of 5")).toBeVisible();

  // Language selection always precedes the privacy notice.
  // Tests call this helper after choosing a language.
  // The notice must be acknowledged before the form can advance.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(formAlert(page)).toContainText("Please confirm you have read");

  await page.getByLabel("I have read the notice above.").click();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(formAlert(page)).toContainText("Select at least one service");

  await page.getByLabel("Reception").click();
  await page.getByLabel("Doctor consultation").click();
  await page.getByRole("button", { name: "Next" }).click();
}

test.describe("patient survey", () => {
  test("allows selecting English when the browser has no randomUUID API", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    });
    await page.goto(SURVEY_PATH);
    const option = page.getByRole("radio", { name: "English", exact: true });
    await page.getByText("English", { exact: true }).click();
    await expect(option).toBeChecked();
    await expect(page.getByRole("button", { name: "Continue to feedback" })).toBeEnabled();
    await page.getByRole("button", { name: "Continue to feedback" }).click();
    await expect(page.getByText("Step 1 of 5")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("asks for language before showing the survey", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to feedback" })).toBeDisabled();
    await expect(page.getByText("Step 1 of 5")).toHaveCount(0);
    await expect(page.getByLabel("I have read the notice above.")).toHaveCount(0);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback" }).click();
    await expect(page.getByText("Step 1 of 5")).toBeVisible();
  });

  test("completes the survey with only a thank-you confirmation", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();

    await completePrivacyAndServices(page);
    await expect(page.getByText("Step 3 of 5")).toBeVisible();

    await answerAllQuestions(page);
    await page.getByRole("button", { name: "Next" }).click();

    // Overall experience is asked separately from the calculated index.
    await expect(page.getByText("Step 4 of 5")).toBeVisible();
    await page.getByRole("radio", { name: "Satisfied", exact: true }).click();
    await page.getByLabel("Anything you would like to add?").fill("Waiting time was short and staff were helpful.");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Step 5 of 5")).toBeVisible();
    await page.getByRole("button", { name: "Submit feedback" }).click();

    await expect(page.getByText("Thank you for submitting your response.")).toBeVisible();
    const confirmation = page.locator('main [role="status"]');
    await expect(confirmation).toHaveText("Thank you for submitting your response.");
    await expect(confirmation).toBeFocused();
    await expect(page.getByText("Your overall experience index")).toHaveCount(0);
    await expect(page.getByText("75.0", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("link")).toHaveCount(0);
  });

  test("shows only thanks for an incomplete acknowledgement too", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
    await completePrivacyAndServices(page);
    await answerAllQuestions(page);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "Satisfied", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.route("**/api/feedback/submit", (route) => route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ publicId: "synthetic-incomplete-reference", status: "INCOMPLETE", patientIndex: null, displayDecimals: 1 }),
    }));
    await page.getByRole("button", { name: "Submit feedback" }).click();
    await expect(page.locator('main [role="status"]')).toHaveText("Thank you for submitting your response.");
    await expect(page.getByText(/synthetic-incomplete-reference|not enough were answered/)).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(0);
  });

  test("requires an answer for every question", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
    await completePrivacyAndServices(page);

    // The counter must say how many are still outstanding.
    await expect(page.getByText(/^0 of 15 answered/)).toBeVisible();

    // Answering only some of them must not advance.
    await page.locator("fieldset").first().getByRole("radio", { name: "4 — Satisfied" }).click();
    await expect(page.getByText(/^1 of 15 answered/)).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();

    await expect(formAlert(page)).toContainText("Please answer every question");
    await expect(page.getByText("Step 3 of 5")).toBeVisible();
    // The message must be brought into view, not left above the fold.
    await expect(formAlert(page)).toBeInViewport();
  });

  test("accepts not-applicable answers without displaying a score", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
    await completePrivacyAndServices(page);

    // Blank the whole reception category (2 questions).
    await answerAllQuestions(page, { notApplicable: [0, 1] });
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "Satisfied", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Submit feedback" }).click();

    await expect(page.getByText("Thank you for submitting your response.")).toBeVisible();
    await expect(page.locator('main [role="status"]')).toHaveText("Thank you for submitting your response.");
    await expect(page.getByText("75.0", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share another response" })).toHaveCount(0);
  });

  test("blocks the submit when consent is given without contact details", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
    await completePrivacyAndServices(page);
    await answerAllQuestions(page);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "Satisfied", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByLabel("I agree to be contacted about my feedback.").click();
    await expect(page.getByLabel("Phone")).toBeVisible();

    await page.getByRole("button", { name: "Submit feedback" }).click();
    await expect(formAlert(page)).toContainText("Give contact details only if you agree");
    await expect(page.getByText("Step 5 of 5")).toBeVisible();
  });

  test("submits without any contact details when consent is withheld", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
    await completePrivacyAndServices(page);
    await answerAllQuestions(page);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "Satisfied", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();

    // Leave the consent box unticked.
    await page.getByRole("button", { name: "Submit feedback" }).click();

    await expect(page.getByText("Thank you for submitting your response.")).toBeVisible();
    // Contact fields must never be shown to someone who declined.
    await expect(page.getByLabel("Phone")).toHaveCount(0);
  });

  test("keeps answers when moving backwards and forwards", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
    await completePrivacyAndServices(page);
    await answerAllQuestions(page);

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("Step 2 of 5")).toBeVisible();
    // The service selection survives the round trip.
    await expect(page.getByLabel("Reception")).toBeChecked();
    await expect(page.getByLabel("Doctor consultation")).toBeChecked();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.locator("fieldset").first().getByRole("radio", { name: "4 — Satisfied" })).toBeChecked();
  });

  test("shows a privacy notice that asks for no identifying data", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();

    const notice = page.locator("main, body").first();
    await expect(notice).toContainText("We do not ask for your name");
    await expect(notice).toContainText("cannot identify you from your answers");
    // Nothing identifying should be in the URL.
    expect(page.url()).not.toMatch(/name|phone|email|dob|birth/i);
  });

  test("is usable at a phone viewport without horizontal scrolling", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
    await completePrivacyAndServices(page);
    await expect(page.getByText("Step 3 of 5")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("is keyboard navigable to the first rating", async ({ page }) => {
    await page.goto(SURVEY_PATH);
    await page.getByRole("radio", { name: "English", exact: true }).click();
    await page.getByRole("button", { name: "Continue to feedback", exact: true }).click();
    await completePrivacyAndServices(page);

    await page.locator("fieldset").first().getByRole("radio", { name: "5 — Very satisfied" }).focus();
    await page.keyboard.press("Space");
    await expect(page.locator("fieldset").first().getByRole("radio", { name: "5 — Very satisfied" })).toBeChecked();
  });

  test("does not disclose an unknown survey", async ({ page }) => {
    const response = await page.goto("/en/feedback/no-such-survey");

    // The slug may be echoed, but no stack trace or internal detail may appear.
    expect(response?.status()).toBeLessThan(500);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/prisma|postgres|at Object\.|node_modules/i);
  });
});
