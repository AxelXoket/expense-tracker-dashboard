// Shared helpers for the panel's behaviour tests: a fixed clock, numbered ids, and queries for what a person sees.
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import App from "../App.jsx";
import { STORAGE_KEY } from "../lib/storage.js";

export const NOW = new Date(2026, 10, 16, 12, 0);
const now = () => NOW;
let ids = 0;
const makeId = () => `id-${++ids}`;

beforeEach(() => {
  ids = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Intl puts no-break spaces in some places; compare what a person reads.
export const read = (text) => text.replace(/\s/g, " ");

export const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
export const seed = (expenses, budgetKurus = null) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, expenses, budgetKurus }));
export const expense = (id, date, category, amountKurus, note = "", createdAt = 0) => ({ id, date, category, amountKurus, note, createdAt });

export function renderApp(props = {}) {
  const user = userEvent.setup({ delay: null });
  const view = render(<App storage={localStorage} now={now} makeId={makeId} {...props} />);
  return { user, ...view };
}

export const rows = (month = "Kasım 2026") => within(screen.getByRole("list", { name: `${month} harcamaları` })).getAllByRole("listitem");
export const rowTexts = (month) => rows(month).map((row) => read(row.textContent));
export const card = (title) => read(screen.getByText(title).parentElement.textContent);
export const expenseCategory = () => screen.getByLabelText("Kategori", { selector: "#expense-category" });
export const filterCategory = () => screen.getByLabelText("Kategori", { selector: "#filter-category" });

/** The edit or delete button of the one row with this category, as a screen reader names it. */
export const rowButton = (categoryLabel, action) => screen.getByRole("button", { name: new RegExp(`${categoryLabel} harcaması: ${action}$`) });

/** The four fields of the expense form. */
export const expenseFields = () => ({
  amount: screen.getByLabelText("Tutar (TL)"),
  date: screen.getByLabelText("Tarih"),
  category: expenseCategory(),
  note: screen.getByLabelText(/^Not/),
});

/**
 * Catch what the panel hands the browser for a download: the files made, the link clicks and the freed file URLs.
 * The test DOM has no object URLs, so URL gets a stand-in that afterEach removes again.
 */
export function captureDownloads() {
  const files = [];
  const revoked = [];
  const clicks = [];
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL(blob) {
      files.push(blob);
      return `blob:dosya-${files.length}`;
    }

    static revokeObjectURL(url) {
      revoked.push(url);
    }
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function record() {
    clicks.push({ download: this.download, href: this.href, connected: this.isConnected });
  });
  return { files, revoked, clicks };
}

export async function addExpense(user, { amount, category, note = "", date }) {
  await user.type(screen.getByLabelText("Tutar (TL)"), amount);
  await user.selectOptions(expenseCategory(), category);
  if (date) fireEvent.change(screen.getByLabelText("Tarih"), { target: { value: date } });
  if (note) await user.type(screen.getByLabelText(/^Not/), note);
  await user.click(screen.getByRole("button", { name: "Ekle" }));
}
