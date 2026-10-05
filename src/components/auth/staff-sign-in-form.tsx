"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function StaffSignInForm() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const tUi = useTranslations("ui");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      // A throttled request is not a rejected password. Reporting it as one
      // sends staff off to reset a password that was correct all along.
      const throttled =
        signInError.status === 429 ||
        signInError.code === "TOO_MANY_REQUESTS" ||
        /too many|rate limit/i.test(signInError.message ?? "");
      setError(throttled ? t("errors.rateLimited") : t("invalidCredentials"));
      return;
    }
    // The session cookie is set by the request; refresh picks up server state.
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="h-12"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-12 pr-12"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted-foreground hover:text-primary"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={tUi(showPassword ? "hidePassword" : "showPassword")}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" size="lg" className="h-12 w-full" disabled={submitting}>
        {submitting ? (
          <><Loader2 aria-hidden className="mr-2 size-4 animate-spin" />{t("signingIn")}</>
        ) : t("signIn")}
      </Button>
    </form>
  );
}
