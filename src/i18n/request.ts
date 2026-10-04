import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Storage stays in UTC; this is only the timezone used to render dates.
    timeZone: process.env.HOSPITAL_TIMEZONE ?? "Asia/Kolkata",
  };
});