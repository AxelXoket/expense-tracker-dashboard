import { CATEGORIES, categoryById, isCategory } from "./categories.js";
import { csvDay, daysInMonth, isRealDay, longDayLabel, monthOf } from "./dates.js";
import { parseAmount, plainKurus } from "./money.js";

export const NOTE_MAX_LENGTH = 80;
export const EARLIEST_DAY = "2000-01-01";

/** Characters as a person counts them: an emoji is one, not two UTF-16 units. */
export function noteLength(note) {
  return [...note].length;
}

/**
 * Check the form values. Returns { values } ready to store, or { errors } keyed by field, in Turkish.
 * `today` is "YYYY-MM-DD"; an expense cannot be dated after it.
 */
export function validateExpense({ amount, category, date, note }, today) {
  const errors = {};
  const parsed = parseAmount(amount);
  if (parsed.error) errors.amount = parsed.error;
  if (!isCategory(category)) errors.category = "Bir kategori seçin.";
  if (!date) errors.date = "Tarihi seçin.";
  else if (!isRealDay(date)) errors.date = "Geçerli bir tarih seçin.";
  else if (date < EARLIEST_DAY) errors.date = `Tarih ${longDayLabel(EARLIEST_DAY)} ya da sonrası olmalı.`;
  else if (date > today) errors.date = "Gelecekteki bir tarih seçilemez.";
  const cleanNote = String(note ?? "").trim().replace(/\s+/g, " ");
  if (noteLength(cleanNote) > NOTE_MAX_LENGTH) errors.note = `Not en çok ${NOTE_MAX_LENGTH} karakter olabilir.`;
  if (Object.keys(errors).length) return { errors };
  return { values: { amountKurus: parsed.kurus, category, date, note: cleanNote } };
}

/**
 * Split 100 percent over the parts in tenths of a percent (1000 in all), so the shares shown with one decimal always
 * add up to exactly %100,0 and each is off by less than 0,1 (largest remainder method). Plain rounding can show
 * 33,3 + 33,3 + 33,3 = 99,9.
 */
export function shareTenths(amounts) {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (total === 0) return amounts.map(() => 0);
  const exact = amounts.map((amount) => (amount * 1000) / total);
  const shares = exact.map(Math.floor);
  let left = 1000 - shares.reduce((sum, share) => sum + share, 0);
  // Array sort is stable, so parts with equal remainders keep their order and the earlier part gets the tenth first.
  const byRemainder = exact.map((value, index) => ({ index, remainder: value - shares[index] }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (left === 0) break;
    shares[index] += 1;
    left -= 1;
  }
  return shares;
}

/** A share from `shareTenths` in Turkish style: "%33,3". A share too small to show is "<%0,1", never "%0,0". */
export function formatShare(tenths) {
  return tenths === 0 ? "<%0,1" : `%${Math.floor(tenths / 10)},${tenths % 10}`;
}

/**
 * Numbers for one month. The daily average divides by the days that have passed: all days of a past month,
 * today's day number for the current month.
 */
export function summarizeMonth(expenses, month, today) {
  const inMonth = expenses.filter((expense) => monthOf(expense.date) === month);
  const total = inMonth.reduce((sum, expense) => sum + expense.amountKurus, 0);
  const totals = new Map();
  for (const expense of inMonth) totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amountKurus);
  const order = CATEGORIES.map((category) => category.id);
  const ranked = [...totals.entries()]
    .sort(([idA, a], [idB, b]) => b - a || order.indexOf(idA) - order.indexOf(idB));
  const tenths = shareTenths(ranked.map(([, amount]) => amount));
  const byCategory = ranked.map(([id, amount], index) => ({ category: categoryById(id), total: amount, shareTenths: tenths[index] }));
  const daysCounted = month === monthOf(today) ? Number(today.slice(8, 10)) : daysInMonth(month);
  return {
    total,
    count: inMonth.length,
    daysCounted,
    dailyAverage: Math.round(total / daysCounted),
    byCategory,
    top: byCategory[0] ?? null,
  };
}

/**
 * Months for the month menu, newest first: those with expenses, the current one, and `shown`, the one on screen.
 * `shown` stays listed after its last expense is deleted, so the menu keeps naming the month the panel shows.
 */
export function availableMonths(expenses, today, shown) {
  const months = new Set(expenses.map((expense) => monthOf(expense.date)));
  months.add(monthOf(today));
  months.add(shown);
  return [...months].sort().reverse();
}

// Entries of the same day follow the date direction; equal amounts show the latest entry first.
const newestEntry = (a, b) => b.createdAt - a.createdAt;
export const SORTS = {
  "date-desc": { label: "Tarih (yeniden eskiye)", compare: (a, b) => b.date.localeCompare(a.date) || newestEntry(a, b) },
  "date-asc": { label: "Tarih (eskiden yeniye)", compare: (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt },
  "amount-desc": { label: "Tutar (büyükten küçüğe)", compare: (a, b) => b.amountKurus - a.amountKurus || newestEntry(a, b) },
  "amount-asc": { label: "Tutar (küçükten büyüğe)", compare: (a, b) => a.amountKurus - b.amountKurus || newestEntry(a, b) },
};

/** The list shown under the filters. */
export function visibleExpenses(expenses, { month, category, sort }) {
  return expenses
    .filter((expense) => monthOf(expense.date) === month && (category === "all" || expense.category === category))
    .sort(SORTS[sort].compare);
}

/**
 * One CSV field. A field that a spreadsheet would run as a formula (starting with = + - @, tab or carriage return)
 * gets a leading apostrophe, as OWASP advises against CSV injection.
 */
function csvField(text) {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\r\n]/.test(safe) || safe !== text ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * CSV for Turkish spreadsheets: semicolons between fields (the comma is the decimal mark), a byte order mark so
 * Excel reads the Turkish letters, and CRLF line ends.
 */
export function expensesToCsv(expenses) {
  const rows = [["Tarih", "Kategori", "Tutar (TL)", "Not"]];
  for (const expense of expenses) {
    rows.push([csvDay(expense.date), categoryById(expense.category).label, plainKurus(expense.amountKurus), expense.note]);
  }
  return "\uFEFF" + rows.map((row) => row.map(csvField).join(";")).join("\r\n") + "\r\n";
}

/**
 * How far the month's spending is into the budget. The percent agrees with `over`: 100 only at exactly the budget,
 * at most 99 below it and at least 101 above it, so the screen never says "%100" next to "aşıldı".
 */
export function budgetStatus(spentKurus, budgetKurus) {
  const exact = (spentKurus * 100) / budgetKurus;
  let percent = 100;
  if (spentKurus < budgetKurus) percent = Math.min(Math.floor(exact), 99);
  if (spentKurus > budgetKurus) percent = Math.max(Math.ceil(exact), 101);
  return { percent, remaining: budgetKurus - spentKurus, over: spentKurus > budgetKurus };
}
