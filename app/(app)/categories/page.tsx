import { createClient } from "@/lib/supabase/server";
import { CategoriesPageClient } from "./categories-client";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: categories }, { data: merchants }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("merchants")
      .select("*, categories(name, color)")
      .eq("user_id", user!.id)
      .order("name"),
  ]);

  return (
    <CategoriesPageClient
      initialCategories={categories ?? []}
      initialMerchants={(merchants as any) ?? []}
    />
  );
}
