"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { approveMonthlyAllocation } from "@/lib/allocation/approve-allocation";

export async function approveAllocationAction(
  allocationId: string,
  adjustments?: Array<{ itemId: string; newAmount: number }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const result = await approveMonthlyAllocation(supabase, user.id, {
    allocationId,
    adjustments: adjustments?.map((a) => ({
      item_id: a.itemId,
      new_amount: a.newAmount,
    })),
  });

  if (!result.success) return { ok: false, error: result.error };

  revalidatePath("/allocation");
  revalidatePath("/dashboard");
  return { ok: true };
}
