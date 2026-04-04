import React from "react";
import Image from "next/image";

const MARKETING_SITE_URL =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://www.budgetpartnerhq.com";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 bg-primary flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/3" />

        <div className="relative z-10">
          <a
            href={MARKETING_SITE_URL}
            className="inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            aria-label="Budget Partner HQ — visit marketing site"
          >
            <Image
              src="/bp_logo.png"
              alt="Budget Partner HQ"
              width={240}
              height={80}
              className="h-16 w-auto max-w-[min(100%,14rem)] object-contain object-left"
              priority
            />
          </a>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="font-display text-4xl font-bold text-white leading-tight">
            Your personal finance
            <br />
            <span className="text-accent-DEFAULT">command centre.</span>
          </h2>
          <p className="text-white/60 text-lg leading-relaxed max-w-sm">
            Track every peso across accounts, cards, and goals — with AI that
            tells you exactly what to do next.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {[
            "Multi-currency account tracking",
            "AI-powered allocation & debt strategy",
            "Real-time safe-to-spend calculator",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-DEFAULT shrink-0" />
              <span className="text-white/70 text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-6 sm:p-8">
        <div className="mb-8 flex justify-center lg:hidden">
          <a
            href={MARKETING_SITE_URL}
            className="inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Budget Partner HQ — visit marketing site"
          >
            <Image
              src="/bp_logo.png"
              alt="Budget Partner HQ"
              width={200}
              height={72}
              className="h-14 w-auto object-contain"
              priority
            />
          </a>
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
