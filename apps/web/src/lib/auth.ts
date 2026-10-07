import { createStaffAuth } from "@hospital/identity/auth";
import { env } from "@/lib/env";

export const auth = createStaffAuth({ secret: env().BETTER_AUTH_SECRET, baseURL: env().BETTER_AUTH_URL, rateLimitMax: env().AUTH_RATE_LIMIT_MAX, rateLimitWindowMs: env().AUTH_RATE_LIMIT_WINDOW_MS });
export type Session = typeof auth.$Infer.Session;
