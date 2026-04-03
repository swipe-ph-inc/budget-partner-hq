/** Canonical money string: optional `-`, digits, optional `.` and up to 4 decimals (no commas). */
export function sanitizeMoneyInput(input: string): string {
  let s = input.replace(/,/g, "").trim();
  if (s === "") return "";

  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  s = s.replace(/[^\d.]/g, "");

  const dot = s.indexOf(".");
  let intPart: string;
  let fracPart: string;
  const hasDot = dot !== -1;

  if (!hasDot) {
    intPart = s;
    fracPart = "";
  } else {
    intPart = s.slice(0, dot);
    fracPart = s.slice(dot + 1).replace(/\./g, "").slice(0, 4);
  }

  intPart = intPart.replace(/\D/g, "");
  if (intPart.length > 1) intPart = intPart.replace(/^0+/, "") || "0";

  let result = neg ? "-" : "";
  if (hasDot) {
    if (intPart === "" && fracPart === "") result += "0.";
    else if (intPart === "") result += "0." + fracPart;
    else result += intPart + "." + fracPart;
  } else {
    result += intPart;
  }

  return result;
}

/** Fee / non-negative amounts: digits and decimals only (no minus). */
export function sanitizeMoneyInputNonNegative(input: string): string {
  const raw = sanitizeMoneyInput(input);
  return raw.startsWith("-") ? raw.slice(1) : raw;
}

export function formatMoneyInputDisplay(raw: string): string {
  if (!raw || raw === "-") return raw;
  const neg = raw.startsWith("-");
  const body = raw.replace(/^-/, "");
  const dotIdx = body.indexOf(".");

  if (dotIdx !== -1) {
    const intDigits = body.slice(0, dotIdx).replace(/\D/g, "") || "0";
    const fracPart = body.slice(dotIdx + 1).replace(/\D/g, "").slice(0, 4);
    const intFmt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${neg ? "-" : ""}${intFmt}.${fracPart}`;
  }

  const intDigits = body.replace(/\D/g, "");
  if (intDigits === "") return neg ? "-" : "";
  const intFmt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${intFmt}`;
}

export function numericToMoneyRaw(n: number): string {
  if (!Number.isFinite(n)) return "";
  return String(Number(n.toFixed(4)));
}

export function parseMoneyInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return 0;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
