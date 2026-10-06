import "dotenv/config";
import { translateDraft, TranslationProviderError } from "./provider";

// Explicit operator verification only: 2 tiny public requests, no patient data.
async function main() {
  for (const locale of ["hi", "mr"] as const) {
    const draft = await translateDraft({ greeting: "Thank you", count: "{count} responses" }, locale);
    if (!draft.greeting?.trim() || !draft.count?.includes("{count}")) throw new Error("Invalid test translation");
    console.log(`Google Translation ${locale}: request succeeded; interpolation preserved.`);
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof TranslationProviderError ? error.message : "Translation verification failed. Provider response and credentials are not logged.");
  process.exitCode = 1;
});
