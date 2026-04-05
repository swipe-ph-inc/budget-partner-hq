"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6 animate-fade-in sm:space-y-8">
      <div className="text-balance">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-[0.9375rem]">
          Choose a strong password for your Budget Partner HQ account.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 [&_input]:min-h-11 [&_input]:text-base sm:[&_input]:min-h-9 sm:[&_input]:text-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
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
          {loading ? "Updating…" : "Update password"}
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
