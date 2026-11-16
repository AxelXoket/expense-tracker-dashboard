// @vitest-environment node
import { describe, expect, it } from "vitest";
import { availableMonths, budgetStatus, EARLIEST_DAY, expensesToCsv, formatShare, NOTE_MAX_LENGTH, shareTenths, SORTS, summarizeMonth, validateExpense, visibleExpenses } from "./expenses.js";
import { csvDay, dayLabel, daysInMonth, isoDay, isRealDay, longDayLabel, monthLabel } from "./dates.js";

const TODAY = "2026-11-16";
const valid = { amount: "250,00", category: "market", date: "2026-11-10", note: "  Haftalık   market " };
const expense = (id, date, category, amountKurus, createdAt = 0, note = "") => ({ id, date, category, amountKurus, createdAt, note });

describe("validateExpense", () => {
  it("accepts a correct expense and tidies the note", () => {
    expect(validateExpense(valid, TODAY)).toEqual({
      values: { amountKurus: 25000, category: "market", date: "2026-11-10", note: "Haftalık market" },
    });
  });

  it("reports every wrong field at once, in Turkish", () => {
    const { errors } = validateExpense({ amount: "", category: "", date: "", note: "x".repeat(NOTE_MAX_LENGTH + 1) }, TODAY);
    expect(errors).toEqual({
      amount: "Tutarı yazın.",
      category: "Bir kategori seçin.",
      date: "Tarihi seçin.",
      note: `Not en çok ${NOTE_MAX_LENGTH} karakter olabilir.`,
    });
  });

  it("allows today and refuses tomorrow", () => {
    expect(validateExpense({ ...valid, date: TODAY }, TODAY).values.date).toBe(TODAY);
    expect(validateExpense({ ...valid, date: "2026-11-17" }, TODAY).errors).toEqual({ date: "Gelecekteki bir tarih seçilemez." });
  });

  it("allows the earliest day and refuses the day before it", () => {
    const [year, month, day] = EARLIEST_DAY.split("-").map(Number);
    const dayBefore = isoDay(new Date(year, month - 1, day - 1));
    expect(validateExpense({ ...valid, date: EARLIEST_DAY }, TODAY).values).toBeDefined();
    expect(validateExpense({ ...valid, date: dayBefore }, TODAY).errors).toEqual({ date: "Tarih 1 Ocak 2000 ya da sonrası olmalı." });
  });

  it("refuses days that do not exist", () => {
    for (const date of ["2026-02-30", "2026-13-01", "16.11.2026", "0050-01-01"]) {
      expect(validateExpense({ ...valid, date }, TODAY).errors).toEqual({ date: "Geçerli bir tarih seçin." });
    }
  });

  it("counts the note after tidying, and counts an emoji as one character", () => {
    const limit = "x".repeat(NOTE_MAX_LENGTH);
    expect(validateExpense({ ...valid, note: ` ${limit} ` }, TODAY).values.note).toBe(limit);
    expect(validateExpense({ ...valid, note: "😀".repeat(NOTE_MAX_LENGTH) }, TODAY).values).toBeDefined();
    expect(validateExpense({ ...valid, note: "😀".repeat(NOTE_MAX_LENGTH + 1) }, TODAY).errors).toEqual({
      note: `Not en çok ${NOTE_MAX_LENGTH} karakter olabilir.`,
    });
  });

  it("treats a missing note as an empty one", () => {
    expect(validateExpense({ amount: "5", category: "market", date: TODAY }, TODAY).values.note).toBe("");
  });

  it("refuses an unknown category", () => {
    expect(validateExpense({ ...valid, category: "kumar" }, TODAY).errors).toEqual({ category: "Bir kategori seçin." });
  });
});

describe("shareTenths", () => {
  it("always adds up to exactly 1000 tenths of a percent", () => {
    expect(shareTenths([1, 1, 1])).toEqual([334, 333, 333]);
    expect(shareTenths([2, 1])).toEqual([667, 333]);
    expect(shareTenths([1, 1, 1, 1, 1, 1, 1])).toEqual([143, 143, 143, 143, 143, 143, 142]);
    expect(shareTenths([5])).toEqual([1000]);
  });

  it("gives leftover tenths to the earlier parts when remainders are equal", () => {
    expect(shareTenths([1, 1, 1, 1, 1, 1])).toEqual([167, 167, 167, 167, 166, 166]);
  });

  it("gives the extra tenth to the largest remainder, not to the first part", () => {
    expect(shareTenths([10, 29, 61])).toEqual([100, 290, 610]);
    expect(shareTenths([1, 2])).toEqual([333, 667]);
    expect(shareTenths([1, 3, 3])).toEqual([143, 429, 428]);
  });

  it("is zero everywhere when nothing was spent", () => {
    expect(shareTenths([0, 0])).toEqual([0, 0]);
  });
});

describe("formatShare", () => {
  it.each([
    [538, "%53,8"],
    [1000, "%100,0"],
    [10, "%1,0"],
    [5, "%0,5"],
    [1, "%0,1"],
    [0, "<%0,1"],
  ])("%i tenths -> %s", (tenths, text) => {
    expect(formatShare(tenths)).toBe(text);
  });
});

describe("summarizeMonth", () => {
  const expenses = [
    expense("a", "2026-11-01", "market", 10000),
    expense("b", "2026-11-15", "fatura", 35000),
    expense("c", "2026-11-16", "market", 20000),
    expense("d", "2026-10-31", "kira", 999900),
  ];

  it("adds up only the chosen month and ranks categories by amount", () => {
    const summary = summarizeMonth(expenses, "2026-11", TODAY);
    expect(summary.total).toBe(65000);
    expect(summary.count).toBe(3);
    expect(summary.byCategory.map((row) => [row.category.id, row.total, row.shareTenths])).toEqual([["fatura", 35000, 538], ["market", 30000, 462]]);
    expect(summary.top.category.label).toBe("Fatura");
  });

  it("divides the current month by the days so far and a past month by all its days", () => {
    expect(summarizeMonth(expenses, "2026-11", TODAY)).toMatchObject({ daysCounted: 16, dailyAverage: 4063 });
    expect(summarizeMonth(expenses, "2026-10", TODAY)).toMatchObject({ daysCounted: 31, dailyAverage: 32255 });
  });

  it("rounds the daily average to the nearest kuruş", () => {
    expect(summarizeMonth([expense("r", "2026-09-10", "market", 100)], "2026-09", TODAY).dailyAverage).toBe(3);
  });

  it("leaves out later months", () => {
    expect(summarizeMonth([...expenses, expense("f", "2026-12-01", "market", 5)], "2026-11", TODAY).total).toBe(65000);
  });

  it("is empty for a month without expenses", () => {
    expect(summarizeMonth(expenses, "2026-09", TODAY)).toMatchObject({ total: 0, count: 0, dailyAverage: 0, byCategory: [], top: null });
  });

  it("breaks ties between categories in list order", () => {
    const tie = [expense("x", "2026-11-02", "diger", 500), expense("y", "2026-11-03", "market", 500)];
    expect(summarizeMonth(tie, "2026-11", TODAY).top.category.id).toBe("market");
  });
});

describe("lists and months", () => {
  const expenses = [
    expense("old", "2026-11-03", "market", 5000, 1),
    expense("big", "2026-11-03", "fatura", 9000, 2),
    expense("new", "2026-11-12", "market", 100, 3),
    expense("prev", "2026-10-20", "market", 7000, 4),
  ];
  const ids = (options) => visibleExpenses(expenses, { month: "2026-11", category: "all", sort: "date-desc", ...options }).map((e) => e.id);

  it("shows the chosen month only, and orders entries of the same day in the date direction", () => {
    expect(ids({})).toEqual(["new", "big", "old"]);
    expect(ids({ sort: "date-asc" })).toEqual(["old", "big", "new"]);
  });

  it("sorts by date whatever order the entries were stored in", () => {
    const stored = [
      expense("late", "2026-11-20", "market", 1, 5),
      expense("b", "2026-11-03", "market", 1, 9),
      expense("a", "2026-11-03", "market", 1, 2),
      expense("early", "2026-11-01", "market", 1, 7),
    ];
    const order = (sort) => visibleExpenses(stored, { month: "2026-11", category: "all", sort }).map((e) => e.id);
    expect(order("date-asc")).toEqual(["early", "a", "b", "late"]);
    expect(order("date-desc")).toEqual(["late", "b", "a", "early"]);
  });

  it("names every sort order", () => {
    expect(Object.values(SORTS).filter(({ label }) => label.trim() === "")).toEqual([]);
    expect(new Set(Object.values(SORTS).map(({ label }) => label)).size).toBe(Object.keys(SORTS).length);
  });

  it("shows the latest entry first when amounts are equal", () => {
    const same = [expense("first", "2026-11-03", "market", 500, 1), expense("second", "2026-11-04", "market", 500, 2)];
    for (const sort of ["amount-desc", "amount-asc"]) {
      expect(visibleExpenses(same, { month: "2026-11", category: "all", sort }).map((e) => e.id)).toEqual(["second", "first"]);
    }
  });

  it("sorts by amount both ways and filters by category", () => {
    expect(ids({ sort: "amount-desc" })).toEqual(["big", "old", "new"]);
    expect(ids({ sort: "amount-asc" })).toEqual(["new", "old", "big"]);
    expect(ids({ category: "market" })).toEqual(["new", "old"]);
    expect(ids({ month: "2026-10" })).toEqual(["prev"]);
  });

  it("offers every month with expenses plus the current one, newest first", () => {
    expect(availableMonths(expenses, TODAY, "2026-11")).toEqual(["2026-11", "2026-10"]);
    expect(availableMonths([], TODAY, "2026-11")).toEqual(["2026-11"]);
    expect(availableMonths([expense("z", "2025-01-05", "market", 1)], TODAY, "2026-11")).toEqual(["2026-11", "2025-01"]);
  });

  it("keeps the month on screen even when it has no expenses left", () => {
    expect(availableMonths([], TODAY, "2026-09")).toEqual(["2026-11", "2026-09"]);
    expect(availableMonths(expenses, TODAY, "2026-09")).toEqual(["2026-11", "2026-10", "2026-09"]);
  });
});

describe("expensesToCsv", () => {
  it("writes a Turkish spreadsheet file", () => {
    const csv = expensesToCsv([
      expense("1", "2026-11-03", "yeme-icme", 123450, 0, 'Doğum günü; "sürpriz"'),
      expense("2", "2026-11-04", "market", 99, 0, ""),
    ]);
    expect(csv).toBe(
      "\uFEFFTarih;Kategori;Tutar (TL);Not\r\n" +
      '03.11.2026;Yeme içme;1234,50;"Doğum günü; ""sürpriz"""\r\n' +
      "04.11.2026;Market;0,99;\r\n",
    );
  });

  const noteField = (note) => expensesToCsv([expense("1", "2026-11-03", "diger", 100, 0, note)]).split("\r\n")[1].split("1,00;")[1];

  it("quotes each special character on its own", () => {
    expect(noteField("a;b")).toBe('"a;b"');
    expect(noteField('a"b')).toBe('"a""b"');
    expect(noteField("a\nb")).toBe('"a\nb"');
    expect(expensesToCsv([expense("1", "2026-11-03", "diger", 100, 0, "a\rb")])).toContain('"a\rb"');
    expect(noteField("a b")).toBe("a b");
  });

  it("keeps a spreadsheet from running a note as a formula", () => {
    expect(noteField("=1+1")).toBe("\"'=1+1\"");
    expect(noteField("+90 532")).toBe("\"'+90 532\"");
    expect(noteField("-%20 indirim")).toBe("\"'-%20 indirim\"");
    expect(noteField("@toplam")).toBe("\"'@toplam\"");
    expect(noteField("\tsekme")).toBe("\"'\tsekme\"");
    expect(noteField("\rsatır")).toBe("\"'\rsatır\"");
    expect(noteField("1=1")).toBe("1=1");
  });
});

describe("budgetStatus", () => {
  it("says 100 percent only at exactly the budget", () => {
    expect(budgetStatus(100000, 100000)).toEqual({ percent: 100, remaining: 0, over: false });
    expect(budgetStatus(99999, 100000)).toEqual({ percent: 99, remaining: 1, over: false });
    expect(budgetStatus(100001, 100000)).toEqual({ percent: 101, remaining: -1, over: true });
  });

  it("rounds down below the budget and up above it", () => {
    expect(budgetStatus(25000, 100000)).toEqual({ percent: 25, remaining: 75000, over: false });
    expect(budgetStatus(25990, 100000).percent).toBe(25);
    expect(budgetStatus(0, 100000).percent).toBe(0);
    expect(budgetStatus(150010, 100000).percent).toBe(151);
    expect(budgetStatus(300000, 100000)).toEqual({ percent: 300, remaining: -200000, over: true });
  });
});

describe("calendar helpers", () => {
  it("knows month lengths, real days and Turkish names", () => {
    expect([daysInMonth("2024-02"), daysInMonth("2026-02"), daysInMonth("2026-11")]).toEqual([29, 28, 30]);
    expect([isRealDay("2024-02-29"), isRealDay("2026-02-29"), isRealDay("2026-1-05")]).toEqual([true, false, false]);
    expect([isRealDay(" 2026-11-16"), isRealDay("2026-11-16x"), isRealDay("2026-00-10"), isRealDay("2026-12-31")]).toEqual([false, false, false, true]);
    // Text after the day must not slip through just because the first three parts still read as numbers.
    expect([isRealDay("2026-11-16 "), isRealDay("2026-11-16-01")]).toEqual([false, false]);
    expect(monthLabel("2026-11")).toBe("Kasım 2026");
    expect(dayLabel("2026-11-16")).toBe("16 Kas 2026");
    expect(csvDay("2026-01-05")).toBe("05.01.2026");
    expect(longDayLabel("2026-11-16")).toBe("16 Kasım 2026");
  });

  it("writes the local calendar day of a moment", () => {
    expect(isoDay(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
    expect(isoDay(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});
