import { getHospitalName } from "@/lib/branding";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "./routing";
import { getEnabledLocales } from "./availability";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) && getEnabledLocales().includes(requested) ? requested : defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;
  const hospitalName = getHospitalName();

  return {
    locale,
    messages: {
      ...messages,
      app: { ...messages.app, name: hospitalName },
      brand: { ...messages.brand, name: hospitalName },
    },
    // Storage stays in UTC; this is only the timezone used to render dates.
    timeZone: process.env.HOSPITAL_TIMEZONE ?? "Asia/Kolkata",
  };
});
