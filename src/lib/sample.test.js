// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isoDay } from "./dates.js";
import { validateExpense } from "./expenses.js";
import { kurusToInput } from "./money.js";
import { sampleExpenses } from "./sample.js";

describe("sample expenses", () => {
  const today = new Date(2026, 0, 3, 10, 0);
  const samples = sampleExpenses(today);

  it("are all valid expenses that the form would accept", () => {
    for (const sample of samples) {
      const form = { amount: kurusToInput(sample.amountKurus), category: sample.category, date: sample.date, note: sample.note };
      expect(validateExpense(form, isoDay(today)).values).toEqual({
        amountKurus: sample.amountKurus, category: sample.category, date: sample.date, note: sample.note,
      });
    }
  });

  it("end today, fill the current month and reach back into the previous year", () => {
    const days = samples.map((sample) => sample.date).sort();
    expect(days.at(-1)).toBe("2026-01-03");
    expect(days.filter((day) => day.startsWith("2026-01")).length).toBeGreaterThan(0);
    expect(days[0]).toBe("2025-11-26");
  });

  it("have unique ids and keep their order", () => {
    expect(new Set(samples.map((sample) => sample.id)).size).toBe(samples.length);
    expect(samples.map((sample) => sample.createdAt)).toEqual([...samples.map((sample) => sample.createdAt)].sort((a, b) => b - a));
  });
});
