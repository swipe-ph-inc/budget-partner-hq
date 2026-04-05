import { describe, expect, it } from "vitest";
import {
  bestMerchantMatch,
  matchCategoryFromHint,
  mergeMerchantIntoDescription,
  buildSafeReceiptApply,
} from "./receipt-autofill";

describe("bestMerchantMatch", () => {
  const merchants = [
    { id: "1", name: "Jollibee" },
    { id: "2", name: "SM Supermarket" },
  ];

  it("matches exact name", () => {
    expect(bestMerchantMatch(merchants, "jollibee")).toEqual({
      merchantId: "1",
      searchLabel: "Jollibee",
    });
  });

  it("matches substring (longest name wins)", () => {
    expect(bestMerchantMatch(merchants, "SM Supermarket Quezon")).toEqual({
      merchantId: "2",
      searchLabel: "SM Supermarket",
    });
  });

  it("returns empty for junk tokens", () => {
    expect(bestMerchantMatch(merchants, "Thank you")).toEqual({
      merchantId: null,
      searchLabel: "",
    });
  });
});

describe("matchCategoryFromHint", () => {
  const categories = [
    { id: "a", name: "Food & Dining" },
    { id: "b", name: "Food Delivery" },
  ];

  it("matches exact", () => {
    expect(matchCategoryFromHint(categories, "Food & Dining")).toBe("a");
  });

  it("returns null when ambiguous", () => {
    expect(matchCategoryFromHint(categories, "Food")).toBe(null);
  });
});

describe("mergeMerchantIntoDescription", () => {
  it("prefixes store line", () => {
    expect(mergeMerchantIntoDescription("Coffee", "Starbucks")).toBe(
      "Coffee · Store (receipt): Starbucks"
    );
  });
});

describe("buildSafeReceiptApply", () => {
  it("does not treat receipt as income", () => {
    const apply = buildSafeReceiptApply(
      {
        type: "income",
        amount: 100,
        date: "2025-01-15",
        currency: "PHP",
        merchant: "Store",
        category_hint: null,
        description: "x",
        fee_amount: null,
      },
      { merchants: [], categories: [], allowedCurrencies: ["PHP"] }
    );
    expect(apply.txType).toBe("expense");
  });
});
