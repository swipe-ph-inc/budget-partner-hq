"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/update-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="space-y-6 animate-fade-in sm:space-y-8">
        <div className="text-balance text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 sm:h-16 sm:w-16">
              <Mail className="h-7 w-7 text-success sm:h-8 sm:w-8" aria-hidden="true" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Check your email
          </h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
            If an account exists for <strong className="break-all text-foreground">{email}</strong>, we
            sent a link to reset your password. Open it on this device to choose a new password.
          </p>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in sm:space-y-8">
      <div className="text-balance">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Forgot password?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-[0.9375rem]">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
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

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm break-words text-destructive sm:px-4">
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
          {loading ? "Sending link…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
