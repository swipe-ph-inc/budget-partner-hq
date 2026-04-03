import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradePrompt({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center animate-fade-in">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <Lock className="h-7 w-7 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href="/pricing">View plans &amp; upgrade</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/profile">Profile</Link>
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Pro unlocks this area and more. Choose a plan on the pricing page; billing checkout will follow.
      </p>
    </div>
  );
}
