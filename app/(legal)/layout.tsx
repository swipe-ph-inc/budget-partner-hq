import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/90 backdrop-blur-sm shrink-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/bp_logo.png"
              alt=""
              width={40}
              height={40}
              className="h-9 w-9 shrink-0 object-contain"
            />
            <span className="font-display font-semibold text-foreground truncate text-sm sm:text-base">
              Budget Partner HQ
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm shrink-0">
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/refund-policy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Refunds
            </Link>
            <Link
              href="/login"
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-8 mt-auto">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Budget Partner HQ</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/refund-policy" className="hover:text-foreground transition-colors">
              Refund Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
