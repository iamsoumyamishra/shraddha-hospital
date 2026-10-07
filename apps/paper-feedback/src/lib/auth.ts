import { createStaffAuth } from "@hospital/identity/auth";
const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;
if (!secret || secret.length < 16 || !baseURL) throw new Error("Configure paper-feedback authentication environment");
export const auth = createStaffAuth({ secret, baseURL, cookiePrefix: "paper-feedback", rateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 3), rateLimitWindowMs: 60000 });
