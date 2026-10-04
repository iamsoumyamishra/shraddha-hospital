import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";

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
    <html lang="en" dir="ltr" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground antialiased">
        {/* Client components (the survey form, sidebar, editors) read interface
            strings through this provider. Locale, messages and timezone are
            inherited from the request config. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}