import { getHospitalName } from "@/lib/branding";
import Link from "next/link";

/**
 * Root not-found. Kept outside the locale segment so it can be rendered for an
 * unknown locale prefix without another lookup.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">
          This page does not exist, or the survey version it referred to is no longer published.
        </p>
        <Link
          href="/en"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {getHospitalName()} · Employee portal
        </Link>
      </div>
    </main>
  );
}