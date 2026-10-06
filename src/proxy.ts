import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { getEnabledLocales, getDefaultLocale } from "@/i18n/availability";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware` to `proxy`. next-intl handles locale
 * negotiation and the always-present locale prefix here.
 */
export default function proxy(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  const localized = routing.locales.includes(parts[0] as typeof routing.locales[number]);
  const patientFeedback = parts[localized ? 1 : 0] === "feedback";
  if (!patientFeedback) {
    if (localized && parts[0] !== "en") {
      const url = request.nextUrl.clone();
      url.pathname = `/en/${parts.slice(1).join("/")}`;
      return NextResponse.redirect(url);
    }
    return createMiddleware({ ...routing, locales: ["en"], defaultLocale: "en", localeDetection: false })(request);
  }
  return createMiddleware({ ...routing, locales: getEnabledLocales(), defaultLocale: getDefaultLocale() })(request);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
