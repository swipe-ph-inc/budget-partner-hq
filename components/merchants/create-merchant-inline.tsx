"use client";

import React, { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";

type MerchantRow = { id: string; name: string };
type CategoryRow = { id: string; name: string };

/**
 * When the user types a merchant name that doesn’t match any saved merchant,
 * offer to create it — using the currently selected category as the merchant’s default category.
 */
export function CreateMerchantInline({
  merchantSearch,
  merchantId,
  categoryId,
  merchants,
  categories,
  onCreated,
}: {
  merchantSearch: string;
  merchantId: string;
  categoryId: string;
  merchants: MerchantRow[];
  categories: CategoryRow[];
  onCreated: (merchant: { id: string; name: string }) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSuggestCreate = useMemo(() => {
    const t = merchantSearch.trim();
    if (t.length < 2 || merchantId !== "__none__") return false;
    const q = t.toLowerCase();
    return !merchants.some((m) => m.name.toLowerCase().includes(q));
  }, [merchantSearch, merchantId, merchants]);

  if (!canSuggestCreate) return null;

  const trimmed = merchantSearch.trim();
  const categoryLabel =
    categoryId === "__none__"
      ? null
      : categories.find((c) => c.id === categoryId)?.name ?? null;

  async function handleClick() {
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from("merchants")
      .insert({
        user_id: user.id,
        name: trimmed,
        category_id: categoryId === "__none__" ? null : categoryId,
      })
      .select("id, name")
      .single();

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    onCreated({ id: data.id, name: data.name });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
      <p className="text-muted-foreground mb-2">
        No merchant matches — add &quot;{trimmed}&quot; to your list?
        {categoryLabel ? (
          <span className="text-foreground"> It will use category &quot;{categoryLabel}&quot; as default.</span>
        ) : (
          <span className="text-foreground"> You can pick a category above first, or save without one.</span>
        )}
      </p>
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        Add merchant
      </Button>
    </div>
  );
}
