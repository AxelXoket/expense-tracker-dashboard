import { isoDay } from "./dates.js";

// A believable month and a half of spending, dated relative to today so the current month is never empty.
// Stryker disable StringLiteral: the sample notes are content; any text is a valid note.
const ENTRIES = [
  [0, "market", 84250, "Haftalık market"],
  [1, "yeme-icme", 32000, "Öğle yemeği"],
  [2, "ulasim", 15000, "Toplu taşıma kartı"],
  [3, "fatura", 61840, "Elektrik"],
  [4, "eglence", 45000, "Sinema"],
  [5, "market", 51975, "Manav"],
  [6, "saglik", 27500, "Eczane"],
  [8, "kira", 1500000, "Kira"],
  [9, "yeme-icme", 18500, "Kahve"],
  [11, "giyim", 129900, "Mont"],
  [12, "egitim", 35000, "Kitap"],
  [13, "fatura", 42990, "İnternet"],
  [15, "ulasim", 120000, "Benzin"],
  [18, "market", 76330, "Haftalık market"],
  [22, "diger", 25000, "Hediye"],
  [27, "yeme-icme", 54000, "Akşam yemeği"],
  [33, "fatura", 38720, "Su ve doğal gaz"],
  [38, "kira", 1500000, "Kira"],
];
// Stryker restore StringLiteral

/** Sample expenses ending on `today` (a Date); `createdAt` keeps their order stable. */
export function sampleExpenses(today) {
  return ENTRIES.map(([daysAgo, category, amountKurus, note], index) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
    return { id: `ornek-${index}`, amountKurus, category, date: isoDay(day), note, createdAt: today.getTime() - index };
  });
}

export const SAMPLE_BUDGET_KURUS = 3_000_000;
