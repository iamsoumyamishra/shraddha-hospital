type DatabaseEnvironment = {
  [key: string]: string | undefined;
  DATABASE_URL?: string;
  STORAGE_DATABASE_URL?: string;
  STORAGE_DATABASE_URL_UNPOOLED?: string;
};

/** Prefer the credentials maintained by the connected Vercel Neon integration. */
export function databaseUrl(environment: DatabaseEnvironment, purpose: "runtime" | "migration" = "runtime"): string {
  const url = (purpose === "migration" ? environment.STORAGE_DATABASE_URL_UNPOOLED : undefined)
    || environment.STORAGE_DATABASE_URL || environment.DATABASE_URL;
  if (!url?.trim()) throw new Error("DATABASE_URL or STORAGE_DATABASE_URL is required");
  return url.trim();
}
