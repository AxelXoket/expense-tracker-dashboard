// Keyboard and screen reader use: where focus goes after each action, what is announced, and the undo time.
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UNDO_MS } from "./components/UndoToast.jsx";
import { STORAGE_KEY } from "./lib/storage.js";
import { addExpense, expense, expenseFields, renderApp, rowButton, rows, seed } from "./test/app.jsx";

const manav = expense("a", "2026-11-10", "market", 12550, "Manav", 1);
const elektrik = expense("b", "2026-11-12", "fatura", 25000, "Elektrik", 2);
const button = (name) => screen.getByRole("button", { name });

describe("focus after each action", () => {
  it("keeps the headings that take focus out of the Tab order", async () => {
    const { user } = renderApp();
    await user.tab();
    expect(screen.getByLabelText("Ay")).toHaveFocus();
  });

  it("moves to the undo button after a deletion and to the restored row after undo", async () => {
    seed([manav, elektrik]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "sil"));
    expect(button("Geri al")).toHaveFocus();
    await user.click(button("Geri al"));
    expect(rowButton("Market", "düzenle")).toHaveFocus();
  });

  it("moves into the form when editing starts and back to the row when it ends", async () => {
    seed([manav, elektrik]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "düzenle"));
    expect(expenseFields().amount).toHaveFocus();
    await user.click(button("Vazgeç"));
    expect(rowButton("Market", "düzenle")).toHaveFocus();

    await user.click(rowButton("Fatura", "düzenle"));
    await user.click(button("Kaydet"));
    expect(rowButton("Fatura", "düzenle")).toHaveFocus();
  });

  it("lands on the list heading when the edited expense moves out of the list", async () => {
    seed([manav, elektrik]);
    const { user } = renderApp();
    await user.selectOptions(screen.getByLabelText("Kategori", { selector: "#filter-category" }), "Market");
    await user.click(rowButton("Market", "düzenle"));
    await user.selectOptions(expenseFields().category, "Diğer");
    await user.click(button("Kaydet"));
    expect(screen.getByRole("heading", { name: /^Harcamalar/ })).toHaveFocus();
  });

  it("puts the safe choice first when deleting everything, and returns after either choice", async () => {
    seed([manav]);
    const { user } = renderApp();
    await user.click(button("Bütün verileri sil"));
    expect(button("Vazgeç")).toHaveFocus();
    await user.click(button("Vazgeç"));
    expect(button("Bütün verileri sil")).toHaveFocus();

    await user.click(button("Bütün verileri sil"));
    await user.click(button("Evet, hepsini sil"));
    expect(expenseFields().amount).toHaveFocus();
  });

  it("goes to the list after the sample is loaded and to the page title after a notice is closed", async () => {
    localStorage.setItem(STORAGE_KEY, "{bozuk");
    const { user } = renderApp();
    await user.click(button("Kapat"));
    expect(screen.getByRole("heading", { name: "Harcama Takip Paneli" })).toHaveFocus();
    await user.click(button("Örnek verilerle dene"));
    expect(screen.getByRole("heading", { name: /^Harcamalar/ })).toHaveFocus();
  });

  it("guides the budget card by keyboard: field on error or change, button after saving or cancelling", async () => {
    const { user } = renderApp();
    const field = () => screen.getByLabelText("Bütçe (TL)");
    await user.type(field(), "abc");
    await user.click(button("Bütçeyi kaydet"));
    expect(field()).toHaveFocus();

    await user.clear(field());
    await user.type(field(), "1.000");
    await user.click(button("Bütçeyi kaydet"));
    expect(button("Bütçeyi değiştir")).toHaveFocus();
    await user.click(button("Bütçeyi değiştir"));
    expect(field()).toHaveFocus();
    await user.click(button("Vazgeç"));
    expect(button("Bütçeyi değiştir")).toHaveFocus();
    await user.click(button("Bütçeyi kaldır"));
    expect(field()).toHaveFocus();
  });
});

describe("announcements", () => {
  it("names the expense in every message, so two entries in a row are both announced", async () => {
    seed([manav]);
    const { user } = renderApp();
    await addExpense(user, { amount: "5", category: "Market" });
    expect(screen.getByRole("status")).toHaveTextContent("Harcama eklendi: Market, ₺5,00.");
    await addExpense(user, { amount: "7", category: "Market" });
    expect(screen.getByRole("status")).toHaveTextContent("Harcama eklendi: Market, ₺7,00.");

    const manavButton = (action) => button(`10 Kasım 2026 tarihli ₺125,50 tutarındaki Market harcaması: ${action}`);
    await user.click(manavButton("düzenle"));
    await user.click(button("Kaydet"));
    expect(screen.getByRole("status")).toHaveTextContent("Değişiklik kaydedildi: Market, ₺125,50.");
    await user.click(manavButton("sil"));
    expect(screen.getByText("Harcama silindi: Market, ₺125,50.")).toBeInTheDocument();
  });

  it("keeps the same status line through an edit, so screen readers follow every message", async () => {
    seed([manav]);
    const { user } = renderApp();
    const status = screen.getByRole("status");
    await user.click(rowButton("Market", "düzenle"));
    await user.click(button("Kaydet"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Değişiklik kaydedildi: Market, ₺125,50.");
  });

  it("marks the row being edited in words, not only in colour", async () => {
    seed([manav, elektrik]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "düzenle"));
    expect(rows().map((row) => row.textContent.includes("Düzenleniyor"))).toEqual([false, true]);
  });
});

describe("undo time", () => {
  it("waits while the undo offer has focus or the pointer, and runs out once both leave", () => {
    vi.useFakeTimers();
    seed([manav]);
    renderApp();
    fireEvent.click(rowButton("Market", "sil"));
    const toast = button("Geri al").parentElement;
    act(() => vi.advanceTimersByTime(UNDO_MS * 3));
    expect(button("Geri al")).toHaveFocus();

    fireEvent.mouseEnter(toast);
    fireEvent.blur(button("Geri al"));
    act(() => vi.advanceTimersByTime(UNDO_MS * 3));
    expect(button("Geri al")).toBeInTheDocument();

    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(button("Geri al")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("button", { name: "Geri al" })).not.toBeInTheDocument();
  });
});
