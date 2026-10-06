import { getHospitalName } from "@/lib/branding";
import type { Metadata } from "next";
import { Noto_Sans_Devanagari, Plus_Jakarta_Sans } from "next/font/google";
import { getLocale } from "next-intl/server";
import { FeedbackDraftProvider } from "@/components/feedback/draft-provider";
import { TEXT_DIRECTION, isLocale } from "@/i18n/catalog";
import "./globals.css";

/*
 * Plus Jakarta Sans for Latin: a geometric humanist face that reads as calm and
 * modern rather than corporate, and holds up at the large sizes used for metric
 * values. Noto Sans Devanagari covers the candidate Hindi and Marathi locales,
 * whose translations need review before publication.
 *
 * The variables are deliberately not named `--font-sans`, because Tailwind's
 * theme block maps that name to itself and a self-reference silently drops the
 * whole stack.
 */
const latin = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-deva",
  display: "swap",
});

const hospitalName = getHospitalName();

export const metadata: Metadata = {
  title: {
    default: hospitalName,
    template: `%s | ${hospitalName}`,
  },
  description: "Patient experience feedback and reporting.",
  // Feedback and contact data must never end up in a referrer header or a
  // third-party session recording.
  referrer: "no-referrer",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={isLocale(locale) ? TEXT_DIRECTION[locale] : "ltr"}
      className={`${latin.variable} ${devanagari.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground antialiased">
        {/* This provider remains mounted above locale navigation. Interface
            messages are provided separately by the locale layout. */}
        <FeedbackDraftProvider>{children}</FeedbackDraftProvider>
      </body>
    </html>
  );
}
