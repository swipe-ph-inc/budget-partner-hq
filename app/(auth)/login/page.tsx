"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const afterLogin = safeRedirectPath(redirectParam);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Show errors from the OAuth callback redirect (?error=auth_callback_failed)
  const callbackError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    callbackError === "auth_callback_failed"
      ? "Google sign-in failed. Please try again."
      : null
  );

  // Clean the ?error= param from the URL so a page refresh doesn't re-show it.
  useEffect(() => {
    if (callbackError) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("error");
      window.history.replaceState(null, "", clean.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(afterLogin);
      router.refresh();
    }
  }

  const googleHref = `/auth/google?next=${encodeURIComponent(afterLogin)}`;

  return (
    <div className="space-y-6 animate-fade-in sm:space-y-8">
      <div className="text-balance">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-[0.9375rem]">
          Sign in to your Budget Partner HQ account
        </p>
      </div>

      {/* Google OAuth — plain <a> forces a raw browser GET so Safari/iPad does
          not block the redirect through Next.js's async client-side router. */}
      <Button
        asChild
        variant="outline"
        size="lg"
        className="w-full min-h-11 gap-2 touch-manipulation border-border bg-white text-foreground hover:bg-gray-50 sm:min-h-10"
      >
        <a
          href={googleHref}
          aria-disabled={loading}
          className={loading ? "pointer-events-none opacity-50" : undefined}
          onClick={() => setError(null)}
        >
          <GoogleIcon />
          Continue with Google
        </a>
      </Button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-3 text-muted-foreground">or sign in with email</span>
        </div>
      </div>

      <form
        onSubmit={handleLogin}
        className="space-y-5 [&_input]:min-h-11 [&_input]:text-base sm:[&_input]:min-h-9 sm:[&_input]:text-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="shrink-0 text-xs text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm text-destructive break-words sm:px-4">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full min-h-11 touch-manipulation sm:min-h-10"
          size="lg"
          disabled={loading}
        >
          {loading && <Loader2 className="animate-spin" />}
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href={
            redirectParam
              ? `/signup?redirect=${encodeURIComponent(redirectParam)}`
              : "/signup"
          }
          className="font-medium text-primary hover:underline"
        >
          Create one
        </Link>
      </p>
      <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-muted-foreground">
        <Link href="/terms" className="hover:text-foreground hover:underline">
          Terms &amp; Conditions
        </Link>
        <span className="hidden opacity-50 sm:inline" aria-hidden="true">
          ·
        </span>
        <Link href="/refund-policy" className="hover:text-foreground hover:underline">
          Refund Policy
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
