import type { Metadata } from "next";
import { Noto_Sans_Devanagari, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";

/*
 * Plus Jakarta Sans for Latin: a geometric humanist face that reads as calm and
 * modern rather than corporate, and holds up at the large sizes used for metric
 * values. Noto Sans Devanagari covers Hindi and Marathi, which are the reviewed
 * locales after English, so switching language never falls back to a system font.
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

export const metadata: Metadata = {
  title: {
    default: "Shraddha Hospital",
    template: "%s | Shraddha Hospital",
  },
  description: "Patient experience feedback and reporting.",
  // Feedback and contact data must never end up in a referrer header or a
  // third-party session recording.
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${latin.variable} ${devanagari.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground antialiased">
        {/* Client components (the survey form, sidebar, editors) read interface
            strings through this provider. Locale, messages and timezone are
            inherited from the request config. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}