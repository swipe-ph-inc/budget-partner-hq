"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronRight,
  ShieldCheck,
  Tag,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn, initials, formatCurrency } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type Merchant = Database["public"]["Tables"]["merchants"]["Row"] & {
  categories: { name: string; color: string | null } | null;
};

const CATEGORY_COLORS = [
  "#032e6d",
  "#28c095",
  "#cea843",
  "#ef4444",
  "#8b5cf6",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#6b7280",
  "#10b981",
];

/** Emoji presets for categories — housing, food, transport, health, money, lifestyle, etc. */
const CATEGORY_ICONS = [
  "🏷️",
  "🏠",
  "🏘️",
  "🛋️",
  "🔑",
  "🍔",
  "🍽️",
  "🥗",
  "🍕",
  "🥘",
  "☕",
  "🍷",
  "🛒",
  "🚗",
  "🚌",
  "🚇",
  "🛵",
  "⛽",
  "🅿️",
  "✈️",
  "🧳",
  "🗺️",
  "🏖️",
  "💊",
  "🏥",
  "🦷",
  "🩺",
  "❤️",
  "📚",
  "✏️",
  "🎓",
  "📖",
  "👶",
  "🍼",
  "🎒",
  "🐕",
  "🐈",
  "🐾",
  "💡",
  "🔌",
  "📶",
  "💧",
  "🎮",
  "🎬",
  "🎵",
  "🎭",
  "🎟️",
  "🛍️",
  "👕",
  "👔",
  "💄",
  "💰",
  "💵",
  "💳",
  "📈",
  "📊",
  "🏦",
  "💼",
  "🛡️",
  "📺",
  "☁️",
  "📱",
  "🎁",
  "🎂",
  "⚽",
  "🏋️",
  "🚴",
  "🌿",
  "🏪",
  "🔧",
  "📦",
  "⭐",
  "🚨",
  "🧾",
];

const TYPE_LABELS: Record<string, string> = {
  income: "Income",
  expense: "Expense",
  both: "Both",
};

function TypeBadge({ type }: { type: "income" | "expense" | "both" }) {
  return (
    <Badge
      variant={
        type === "income" ? "income" : type === "expense" ? "expense" : "secondary"
      }
      className="text-xs"
    >
      {TYPE_LABELS[type]}
    </Badge>
  );
}

// ─── Category Form ───────────────────────────────────────────────────────────
function CategoryForm({
  category,
  categories,
  onSuccess,
  onClose,
}: {
  category?: Category;
  categories: Category[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<"income" | "expense" | "both">(
    category?.type ?? "expense"
  );
  const [parentId, setParentId] = useState<string>(
    category?.parent_id ?? "__none__"
  );
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(category?.icon ?? "🏷️");
  const [budgetAmount, setBudgetAmount] = useState(
    category?.budget_amount?.toString() ?? ""
  );
  const [isSurvival, setIsSurvival] = useState(category?.is_survival ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  // Exclude self and descendants from parent options
  const parentOptions = categories.filter(
    (c) => c.id !== category?.id && c.parent_id === null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

    const payload = {
      name,
      type,
      parent_id: parentId === "__none__" ? null : parentId,
      color,
      icon,
      budget_amount: budgetAmount ? parseFloat(budgetAmount) : null,
      is_survival: isSurvival,
    };

    const { error: dbError } = category
      ? await supabase.from("categories").update(payload).eq("id", category.id)
      : await supabase
          .from("categories")
          .insert({ ...payload, user_id: user.id });

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="cat-name">Name *</Label>
        <Input
          id="cat-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Groceries"
        />
      </div>

      <div className="space-y-2">
        <Label>Type *</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(["income", "expense", "both"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                type === t
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-secondary"
              )}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Parent category</Label>
        <Select value={parentId} onValueChange={setParentId}>
          <SelectTrigger>
            <SelectValue placeholder="None (top-level)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None (top-level)</SelectItem>
            {parentOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Icon</Label>
        <p className="text-xs text-muted-foreground -mt-0.5 mb-1">
          Tap an emoji to use it for this category.
        </p>
        <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-secondary/20 p-2">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ICONS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setIcon(em)}
                title={em}
                className={cn(
                  "w-9 h-9 shrink-0 rounded-lg border text-lg flex items-center justify-center transition-all",
                  icon === em
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:bg-secondary"
                )}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Colour</Label>
        <div className="flex gap-2 flex-wrap">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all",
                color === c ? "border-foreground scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-budget">Monthly budget (optional)</Label>
        <Input
          id="cat-budget"
          type="number"
          min="0"
          step="0.01"
          value={budgetAmount}
          onChange={(e) => setBudgetAmount(e.target.value)}
          placeholder="e.g. 5000"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-warning-600" />
            Priority 1 — Survival expense
          </p>
          <p className="text-xs text-muted-foreground">
            Mark this as a non-negotiable survival expense
          </p>
        </div>
        <Switch checked={isSurvival} onCheckedChange={setIsSurvival} />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving…" : category ? "Update category" : "Add category"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Merchant Form ────────────────────────────────────────────────────────────
function MerchantForm({
  merchant,
  categories,
  onSuccess,
  onClose,
}: {
  merchant?: Merchant;
  categories: Category[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(merchant?.name ?? "");
  const [categoryId, setCategoryId] = useState<string>(
    merchant?.category_id ?? "__none__"
  );
  const [website, setWebsite] = useState(merchant?.website ?? "");
  const [notes, setNotes] = useState(merchant?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

    const payload = {
      name,
      category_id: categoryId === "__none__" ? null : categoryId,
      website: website || null,
      notes: notes || null,
    };

    const { error: dbError } = merchant
      ? await supabase.from("merchants").update(payload).eq("id", merchant.id)
      : await supabase
          .from("merchants")
          .insert({ ...payload, user_id: user.id });

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="mer-name">Merchant name *</Label>
        <Input
          id="mer-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jollibee"
        />
      </div>

      <div className="space-y-2">
        <Label>Default category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No category</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mer-website">Website</Label>
        <Input
          id="mer-website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mer-notes">Notes</Label>
        <Textarea
          id="mer-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes…"
          rows={3}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving…" : merchant ? "Update merchant" : "Add merchant"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Category Tree Node ────────────────────────────────────────────────────────
function CategoryNode({
  category,
  children,
  onEdit,
  onDelete,
}: {
  category: Category;
  children: Category[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  const displayCurrency = useDisplayCurrency();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="group">
      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors">
        {/* Expand toggle */}
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-5 h-5 flex items-center justify-center text-muted-foreground"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                expanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Colour dot + icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ background: `${category.color ?? "#6b7280"}20` }}
        >
          {category.icon ?? <Tag className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">
              {category.name}
            </span>
            <TypeBadge type={category.type} />
            {category.is_survival && (
              <Badge variant="warning" className="text-xs">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Survival
              </Badge>
            )}
          </div>
          {category.budget_amount && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Budget: {formatCurrency(category.budget_amount, displayCurrency)}/mo
            </p>
          )}
        </div>

        {/* Colour swatch */}
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: category.color ?? "#6b7280" }}
        />

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(category)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(category)}
            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Children */}
      {expanded && children.length > 0 && (
        <div className="ml-8 mt-0.5 border-l border-border pl-4 space-y-0.5">
          {children.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              children={[]}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Client Component ─────────────────────────────────────────────────────
interface Props {
  initialCategories: Category[];
  initialMerchants: Merchant[];
}

export function CategoriesPageClient({
  initialCategories,
  initialMerchants,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Sheet state
  const [catSheetOpen, setCatSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [merSheetOpen, setMerSheetOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | undefined>();

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "category" | "merchant";
    item: Category | Merchant;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Merchant search
  const [merchantSearch, setMerchantSearch] = useState("");

  // Build category tree
  const parentCategories = initialCategories.filter((c) => !c.parent_id);
  const childrenByParent = useMemo(() => {
    const map: Record<string, Category[]> = {};
    initialCategories.forEach((c) => {
      if (c.parent_id) {
        if (!map[c.parent_id]) map[c.parent_id] = [];
        map[c.parent_id].push(c);
      }
    });
    return map;
  }, [initialCategories]);

  // Filtered merchants
  const filteredMerchants = useMemo(() => {
    if (!merchantSearch.trim()) return initialMerchants;
    const q = merchantSearch.toLowerCase();
    return initialMerchants.filter((m) => m.name.toLowerCase().includes(q));
  }, [initialMerchants, merchantSearch]);

  function openNewCategory() {
    setEditingCategory(undefined);
    setCatSheetOpen(true);
  }

  function openEditCategory(c: Category) {
    setEditingCategory(c);
    setCatSheetOpen(true);
  }

  function openNewMerchant() {
    setEditingMerchant(undefined);
    setMerSheetOpen(true);
  }

  function openEditMerchant(m: Merchant) {
    setEditingMerchant(m);
    setMerSheetOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);

    let dbError;
    if (deleteTarget.type === "category") {
      const item = deleteTarget.item as Category;
      // Check if transactions reference this category
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("category_id", item.id);
      if (count && count > 0) {
        setDeleteError(
          `Cannot delete: ${count} transaction(s) use this category.`
        );
        setDeleteLoading(false);
        return;
      }
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", item.id);
      dbError = error;
    } else {
      const item = deleteTarget.item as Merchant;
      const { error } = await supabase
        .from("merchants")
        .delete()
        .eq("id", item.id);
      dbError = error;
    }

    if (dbError) {
      setDeleteError(dbError.message);
      setDeleteLoading(false);
      return;
    }

    router.refresh();
    setDeleteTarget(null);
    setDeleteLoading(false);
  }

  const CategoriesPanel = (
    <div className="space-y-1">
      {parentCategories.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto">
            <Tag className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No categories yet</p>
          <Button size="sm" onClick={openNewCategory}>
            <Plus className="h-4 w-4" />
            Add category
          </Button>
        </div>
      ) : (
        parentCategories.map((cat) => (
          <CategoryNode
            key={cat.id}
            category={cat}
            children={childrenByParent[cat.id] ?? []}
            onEdit={openEditCategory}
            onDelete={(c) =>
              setDeleteTarget({ type: "category", item: c })
            }
          />
        ))
      )}
    </div>
  );

  const MerchantSearchBar = (
    <div className="relative shrink-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder="Search merchants…"
        value={merchantSearch}
        onChange={(e) => setMerchantSearch(e.target.value)}
      />
    </div>
  );

  const MerchantsListBody =
    filteredMerchants.length === 0 ? (
      <div className="text-center py-12 space-y-3">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto">
          <Store className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          {merchantSearch ? "No merchants match your search" : "No merchants yet"}
        </p>
        {!merchantSearch && (
          <Button size="sm" onClick={openNewMerchant}>
            <Plus className="h-4 w-4" />
            Add merchant
          </Button>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredMerchants.map((merchant) => (
          <div
            key={merchant.id}
            className="group flex items-center gap-3 p-3 rounded-lg border border-border hover:shadow-card-hover transition-all cursor-pointer bg-card"
            onClick={() => openEditMerchant(merchant)}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm text-white shrink-0"
              style={{
                background:
                  merchant.categories?.color ?? "#6b7280",
              }}
            >
              {initials(merchant.name)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground truncate">
                {merchant.name}
              </p>
              {merchant.categories && (
                <p className="text-xs text-muted-foreground truncate">
                  {merchant.categories.name}
                </p>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget({ type: "merchant", item: merchant });
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-display font-bold text-foreground sm:text-2xl">
            Categories &amp; Merchants
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {initialCategories.length} categories · {initialMerchants.length}{" "}
            merchants
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" onClick={openNewMerchant} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Merchant
          </Button>
          <Button onClick={openNewCategory} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Category
          </Button>
        </div>
      </div>

      {/* Mobile: tabs | Desktop: split view */}
      <div className="block lg:hidden">
        <Tabs defaultValue="categories">
          <TabsList className="w-full">
            <TabsTrigger value="categories" className="flex-1">
              <Tag className="h-4 w-4 mr-1.5" />
              Categories ({initialCategories.length})
            </TabsTrigger>
            <TabsTrigger value="merchants" className="flex-1">
              <Store className="h-4 w-4 mr-1.5" />
              Merchants ({initialMerchants.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="categories" className="mt-4 outline-none">
            <div className="max-h-[min(58vh,480px)] min-h-[12rem] overflow-y-auto overscroll-contain rounded-lg border border-border/70 bg-card p-3">
              {CategoriesPanel}
            </div>
          </TabsContent>
          <TabsContent value="merchants" className="mt-4 outline-none">
            <div className="flex max-h-[min(58vh,520px)] min-h-[12rem] flex-col gap-3 overflow-hidden">
              {MerchantSearchBar}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-border/70 bg-card p-3">
                {MerchantsListBody}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-6">
        {/* Left: Categories */}
        <div className="flex min-h-0 max-h-[min(75vh,620px)] flex-col overflow-hidden rounded-xl border border-border bg-card p-5">
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Categories
              <span className="text-xs font-normal text-muted-foreground">
                ({initialCategories.length})
              </span>
            </h2>
            <Button size="sm" variant="outline" onClick={openNewCategory}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <Separator className="my-4 shrink-0" />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 -mr-0.5">
            {CategoriesPanel}
          </div>
        </div>

        {/* Right: Merchants */}
        <div className="flex min-h-0 max-h-[min(75vh,620px)] flex-col overflow-hidden rounded-xl border border-border bg-card p-5">
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
              <Store className="h-4 w-4" />
              Merchants
              <span className="text-xs font-normal text-muted-foreground">
                ({initialMerchants.length})
              </span>
            </h2>
            <Button size="sm" variant="outline" onClick={openNewMerchant}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <Separator className="my-4 shrink-0" />
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {MerchantSearchBar}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 -mr-0.5">
              {MerchantsListBody}
            </div>
          </div>
        </div>
      </div>

      {/* Category Sheet */}
      <Sheet open={catSheetOpen} onOpenChange={setCatSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingCategory ? "Edit category" : "Add category"}
            </SheetTitle>
            <SheetDescription>
              {editingCategory
                ? "Update this category's details."
                : "Create a new spending or income category."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CategoryForm
              category={editingCategory}
              categories={initialCategories}
              onSuccess={() => setCatSheetOpen(false)}
              onClose={() => setCatSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Merchant Sheet */}
      <Sheet open={merSheetOpen} onOpenChange={setMerSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingMerchant ? "Edit merchant" : "Add merchant"}
            </SheetTitle>
            <SheetDescription>
              {editingMerchant
                ? "Update this merchant's details."
                : "Add a new merchant to your list."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <MerchantForm
              merchant={editingMerchant}
              categories={initialCategories}
              onSuccess={() => setMerSheetOpen(false)}
              onClose={() => setMerSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {deleteTarget?.type === "category"
                  ? (deleteTarget.item as Category).name
                  : (deleteTarget?.item as Merchant)?.name}
              </strong>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {deleteError}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
