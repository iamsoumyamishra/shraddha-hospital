import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Next.js 16 renamed `middleware` to `proxy`. next-intl handles locale
 * negotiation and the always-present locale prefix here.
 */
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};