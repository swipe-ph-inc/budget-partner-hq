"use client";

import React, { createContext, useContext } from "react";

const DisplayCurrencyContext = createContext<string>("PHP");

export function DisplayCurrencyProvider({
  baseCurrency,
  children,
}: {
  baseCurrency: string;
  children: React.ReactNode;
}) {
  return (
    <DisplayCurrencyContext.Provider value={baseCurrency}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

/** Profile base currency. Use: `const displayCurrency = useDisplayCurrency();` then `formatCurrency(amount, displayCurrency)` (symbol only, no conversion). */
export function useDisplayCurrency() {
  return useContext(DisplayCurrencyContext);
}
