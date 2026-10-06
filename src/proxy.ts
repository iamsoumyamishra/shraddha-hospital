import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getEnabledLocales, getDefaultLocale } from "@/i18n/availability";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware` to `proxy`. next-intl handles locale
 * negotiation and the always-present locale prefix here.
 */
export default function proxy(request: NextRequest) {
  return createMiddleware({ ...routing, locales: getEnabledLocales(), defaultLocale: getDefaultLocale() })(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
