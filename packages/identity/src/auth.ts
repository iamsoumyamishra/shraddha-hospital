import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@hospital/database";


export function createStaffAuth(config: { secret: string; baseURL: string; cookiePrefix?: string; rateLimitMax: number; rateLimitWindowMs: number }) {
return betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: config.secret,
  baseURL: config.baseURL,
  emailAndPassword: {
    disableSignUp: true,
    enabled: true,
    requireEmailVerification: false,
  },
  rateLimit: {
    enabled: true,
    window: Math.ceil(config.rateLimitWindowMs / 1000),
    // Applies to the credential endpoints, which is the only place a guessable
    // secret is checked.
    customRules: {
      "/sign-in/email": { window: Math.ceil(config.rateLimitWindowMs / 1000), max: config.rateLimitMax },
    },
  },
  session: {
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 60,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    cookiePrefix: config.cookiePrefix ?? "better-auth",
    // Cookie-authenticated mutations must not ride along on ambient credentials.
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  },
  plugins: [nextCookies()],
});

}
