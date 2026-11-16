// Dates are stored as local calendar days ("2026-11-16") and months as "2026-11"; no time zone can shift them.

const pad = (number) => String(number).padStart(2, "0");

/** Local calendar day of a Date as "YYYY-MM-DD". */
export function isoDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthOf(day) {
  return day.slice(0, 7);
}

/**
 * "2026-02-30" is not a real day; only days that exist on the calendar pass. JavaScript rolls a bad day or month over
 * (February 30 becomes March 2, month 13 becomes January of the next year), so a changed year or day gives it away.
 */
export function isRealDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [year, month, date] = day.split("-").map(Number);
  const parsed = new Date(year, month - 1, date);
  return parsed.getFullYear() === year && parsed.getDate() === date;
}

export function daysInMonth(month) {
  const [year, number] = month.split("-").map(Number);
  return new Date(year, number, 0).getDate();
}

const monthName = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });
const shortDay = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const longDay = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

const toDate = (day) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date || 1);
};

/** "2026-11" -> "Kasım 2026" */
export function monthLabel(month) {
  return monthName.format(toDate(month));
}

/** "2026-11-16" -> "16 Kas 2026" */
export function dayLabel(day) {
  return shortDay.format(toDate(day));
}

/** "2026-11-16" -> "16 Kasım 2026", for screen readers and titles. */
export function longDayLabel(day) {
  return longDay.format(toDate(day));
}

/** "16.11.2026": day first, the way Turkish spreadsheets read a date. */
export function csvDay(day) {
  const [year, month, date] = day.split("-");
  return `${date}.${month}.${year}`;
}
