import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type AllocationRow = Database["public"]["Tables"]["monthly_allocations"]["Row"];

export type ApproveAllocationInput = {
  allocationId: string;
  adjustments?: Array<{ item_id: string; new_amount: number }>;
};

export type ApproveAllocationResult =
  | { success: true; allocation: AllocationRow }
  | { success: false; error: string };

/**
 * Updates optional line-item amounts, then marks the allocation approved.
 * Used by MCP and the in-app Allocation page (same rules as RLS).
 */
export async function approveMonthlyAllocation(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: ApproveAllocationInput
): Promise<ApproveAllocationResult> {
  const { allocationId, adjustments } = input;

  if (adjustments && adjustments.length > 0) {
    for (const adj of adjustments) {
      const { error: itemErr } = await supabase
        .from("allocation_items")
        // @ts-expect-error -- Supabase client infers `.update()` on this table as `never` (schema typing quirk).
        .update({ amount: adj.new_amount })
        .eq("id", adj.item_id)
        .eq("allocation_id", allocationId);
      if (itemErr) return { success: false, error: itemErr.message };
    }
  }

  const { data, error } = await supabase
    .from("monthly_allocations")
    // @ts-expect-error -- Supabase client infers `.update()` on this table as `never` (schema typing quirk).
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
    })
    .eq("id", allocationId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, allocation: data };
}
