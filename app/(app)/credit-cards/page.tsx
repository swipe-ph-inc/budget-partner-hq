import { createClient } from "@/lib/supabase/server";
import { CreditCardsPageClient } from "./credit-cards-client";
import { FREE_TIER_CREDIT_CARD_LIMIT, isProSubscriber } from "@/lib/subscription-access";

export default async function CreditCardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: cards }, { data: profile }] = await Promise.all([
    supabase
      .from("credit_cards")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
    supabase.from("profiles").select("plan, plan_expires_at").eq("id", user!.id).single(),
  ]);

  const isPro = isProSubscriber(profile);
  const activeCount = (cards ?? []).length;
  const canAddCard = isPro || activeCount < FREE_TIER_CREDIT_CARD_LIMIT;

  // Calculate outstanding balance for each card from transactions
  const cardIds = (cards ?? []).map((c) => c.id);
  let balanceMap: Record<string, number> = {};

  if (cardIds.length > 0) {
    const { data: txData } = await supabase
      .from("transactions")
      .select("credit_card_id, type, amount")
      .eq("user_id", user!.id)
      .in("credit_card_id", cardIds)
      .in("type", ["credit_charge", "credit_payment"]);

    (txData ?? []).forEach((tx) => {
      const id = tx.credit_card_id!;
      if (!balanceMap[id]) balanceMap[id] = 0;
      if (tx.type === "credit_charge") {
        balanceMap[id] += tx.amount;
      } else if (tx.type === "credit_payment") {
        balanceMap[id] -= tx.amount;
      }
    });
  }

  const cardsWithBalance = (cards ?? []).map((card) => ({
    ...card,
    outstanding_balance: Math.max(0, balanceMap[card.id] ?? 0),
  }));

  return (
    <CreditCardsPageClient
      initialCards={cardsWithBalance}
      isPro={isPro}
      canAddCard={canAddCard}
      cardLimit={FREE_TIER_CREDIT_CARD_LIMIT}
    />
  );
}
