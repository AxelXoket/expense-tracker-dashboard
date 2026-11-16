// Amounts are kept as whole kuruş (1 TL = 100 kuruş), so sums never drift the way floating point numbers do.

export const MAX_AMOUNT_KURUS = 10_000_000 * 100;

const currency = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });

/** 123450 -> "₺1.234,50" */
export function formatKurus(kurus) {
  return currency.format(kurus / 100);
}

/** 123450 -> "1234,50": plain number for CSV, so spreadsheets read it as a number. */
export function plainKurus(kurus) {
  const sign = kurus < 0 ? "-" : "";
  const absolute = Math.abs(kurus);
  return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, "0")}`;
}

// "1.234,50" (Turkish), "1234,5", or "12.5" (dot as decimal point). A group never starts with 0: "0.500" is refused.
const TURKISH_GROUPED = /^[1-9]\d{0,2}(\.\d{3})+(,\d{1,2})?$/;
const SPACE_GROUPED = /^[1-9]\d{0,2}( \d{3})+(,\d{1,2})?$/;
const COMMA_DECIMAL = /^\d+(,\d{1,2})?$/;
const DOT_DECIMAL = /^\d+\.\d{1,2}$/;

/**
 * Read an amount typed by a person. Returns { kurus } or { error } with a Turkish message.
 * "1.234" is read as one thousand two hundred thirty-four, the way it is written in Turkish. A currency sign is
 * allowed only at the ends, and a space only between groups of three digits ("1 234,50"), so "12 50" is refused.
 */
export function parseAmount(text) {
  const trimmed = String(text ?? "").replace(/\s+/g, " ").trim().replace(/^₺ ?/, "").replace(/ ?(TL|₺)$/i, "");
  const cleaned = SPACE_GROUPED.test(trimmed) ? trimmed.replaceAll(" ", "") : trimmed;
  if (cleaned === "") return { error: "Tutarı yazın." };

  let lira;
  let fraction;
  if (TURKISH_GROUPED.test(cleaned) || COMMA_DECIMAL.test(cleaned)) {
    [lira, fraction = ""] = cleaned.replaceAll(".", "").split(",");
  } else if (DOT_DECIMAL.test(cleaned)) {
    [lira, fraction] = cleaned.split(".");
  } else {
    return { error: "Tutarı 1.250,50 biçiminde yazın." };
  }

  const kurus = Number(lira) * 100 + Number(fraction.padEnd(2, "0"));
  if (kurus <= 0) return { error: "Tutar sıfırdan büyük olmalı." };
  if (kurus > MAX_AMOUNT_KURUS) return { error: `Tutar en çok ${formatKurus(MAX_AMOUNT_KURUS)} olabilir.` };
  return { kurus };
}

/** 123450 -> "1.234,50": the value shown back in the amount field when an expense is edited. */
export function kurusToInput(kurus) {
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kurus / 100);
}
