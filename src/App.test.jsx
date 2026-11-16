import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UNDO_MS } from "./components/UndoToast.jsx";
import { expensesToCsv } from "./lib/expenses.js";
import { SAMPLE_BUDGET_KURUS } from "./lib/sample.js";
import { BACKUP_PREFIX, STORAGE_KEY } from "./lib/storage.js";
import { addExpense, captureDownloads, card, expense, NOW, read, renderApp, rows, rowTexts, seed, stored } from "./test/app.jsx";

describe("adding expenses", () => {
  it("adds an expense and shows it in the list, the summary and the breakdown", async () => {
    const { user } = renderApp();
    await addExpense(user, { amount: "1.250,50", category: "Market", note: "Haftalık market" });

    expect(rowTexts()).toEqual([expect.stringContaining("16 Kas 2026Market")]);
    expect(rowTexts()[0]).toContain("Haftalık market₺1.250,50");
    expect(card("Toplam harcama")).toBe("Toplam harcama₺1.250,50Kasım 2026");
    expect(card("En çok harcanan")).toBe("En çok harcananMarket₺1.250,50");
    expect(screen.getByRole("status")).toHaveTextContent("Harcama eklendi: Market, ₺1.250,50.");
    expect(stored().expenses).toEqual([
      { id: "id-1", createdAt: NOW.getTime(), amountKurus: 125050, category: "market", date: "2026-11-16", note: "Haftalık market" },
    ]);
  });

  it("clears the amount and the note but keeps category and date for the next entry", async () => {
    const { user } = renderApp();
    await addExpense(user, { amount: "10", category: "Ulaşım", note: "Otobüs" });
    expect(screen.getByLabelText("Tutar (TL)")).toHaveValue("");
    expect(screen.getByLabelText("Tutar (TL)")).toHaveFocus();
    expect(screen.getByLabelText(/^Not/)).toHaveValue("");
    expect(screen.getByLabelText("Kategori", { selector: "#expense-category" })).toHaveValue("ulasim");
    expect(screen.getByLabelText("Tarih")).toHaveValue("2026-11-16");
  });

  it("keeps the data after the page is opened again", async () => {
    const { user, unmount } = renderApp();
    await addExpense(user, { amount: "99,90", category: "Eğlence" });
    unmount();
    renderApp();
    expect(rowTexts()[0]).toContain("₺99,90");
  });

  it("shows Turkish errors next to the wrong fields, focuses the first one and saves nothing", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Ekle" }));
    const amount = screen.getByLabelText("Tutar (TL)");
    expect(amount).toHaveFocus();
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveAccessibleDescription("Tutarı yazın.");
    expect(screen.getByLabelText("Kategori", { selector: "#expense-category" })).toHaveAccessibleDescription("Bir kategori seçin.");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    await user.type(amount, "5");
    await user.click(screen.getByRole("button", { name: "Ekle" }));
    expect(screen.getByLabelText("Kategori", { selector: "#expense-category" })).toHaveFocus();
    expect(amount).not.toHaveAttribute("aria-invalid");
  });

  it("refuses a date after today", async () => {
    const { user } = renderApp();
    await addExpense(user, { amount: "5", category: "Market", date: "2026-11-17" });
    expect(screen.getByLabelText("Tarih")).toHaveAccessibleDescription("Gelecekteki bir tarih seçilemez.");
    expect(screen.getByLabelText("Tarih")).toHaveFocus();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("moves to the month of an expense dated in another month", async () => {
    const { user } = renderApp();
    await addExpense(user, { amount: "70", category: "Fatura", date: "2026-10-05" });
    expect(screen.getByLabelText("Ay")).toHaveValue("2026-10");
    expect(rowTexts("Ekim 2026")[0]).toContain("5 Eki 2026Fatura");
  });
});

describe("editing and deleting", () => {
  const market = expense("a", "2026-11-10", "market", 125050, "Haftalık market", 1);

  it("edits an expense in the form and saves the change", async () => {
    seed([market]);
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: /Market harcaması: düzenle$/ }));
    expect(screen.getByRole("heading", { name: "Harcamayı düzenle" })).toBeInTheDocument();
    const amount = screen.getByLabelText("Tutar (TL)");
    expect(amount).toHaveValue("1.250,50");
    await user.clear(amount);
    await user.type(amount, "1.300");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(screen.getByRole("heading", { name: "Harcama ekle" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Değişiklik kaydedildi: Market, ₺1.300,00.");
    expect(rowTexts()).toHaveLength(1);
    expect(rowTexts()[0]).toContain("₺1.300,00");
    expect(stored().expenses).toEqual([{ ...market, amountKurus: 130000 }]);
  });

  it("leaves the expense unchanged when editing is cancelled", async () => {
    seed([market]);
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: /düzenle$/ }));
    await user.type(screen.getByLabelText("Tutar (TL)"), "9");
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(screen.getByRole("heading", { name: "Harcama ekle" })).toBeInTheDocument();
    expect(rowTexts()[0]).toContain("₺1.250,50");
  });

  it("deletes an expense and brings it back with undo", async () => {
    seed([market, expense("b", "2026-11-11", "ulasim", 1500, "", 2)]);
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "10 Kasım 2026 tarihli ₺1.250,50 tutarındaki Market harcaması: sil" }));
    expect(rowTexts()).toHaveLength(1);
    expect(stored().expenses.map((item) => item.id)).toEqual(["b"]);
    expect(screen.getByText("Harcama silindi: Market, ₺1.250,50.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Geri al" }));
    expect(rowTexts()).toHaveLength(2);
    expect(stored().expenses.map((item) => item.id).sort()).toEqual(["a", "b"]);
    expect(screen.queryByText(/^Harcama silindi/)).not.toBeInTheDocument();
  });

  it("offers undo for a few seconds once the person moves on", () => {
    vi.useFakeTimers();
    seed([market]);
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /harcaması: sil$/ }));
    fireEvent.blur(screen.getByRole("button", { name: "Geri al" }));
    act(() => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(screen.getByRole("button", { name: "Geri al" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("button", { name: "Geri al" })).not.toBeInTheDocument();
  });

  it("closes the edit form when the expense being edited is deleted", async () => {
    seed([market]);
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: /düzenle$/ }));
    await user.click(screen.getByRole("button", { name: /harcaması: sil$/ }));
    expect(screen.getByRole("heading", { name: "Harcama ekle" })).toBeInTheDocument();
  });
});

describe("budget", () => {
  it("tracks the month against the budget and warns once it is passed", async () => {
    seed([expense("a", "2026-11-02", "market", 100000)]);
    const { user } = renderApp();
    await user.type(screen.getByLabelText("Bütçe (TL)"), "1.000");
    await user.click(screen.getByRole("button", { name: "Bütçeyi kaydet" }));
    expect(screen.getByRole("progressbar", { name: "Bütçenin kullanılan kısmı" })).toHaveAttribute("aria-valuenow", "100");
    expect(read(screen.getByText(/kullanıldı\)\.$/).textContent)).toBe("₺0,00 kaldı (%100 kullanıldı).");
    expect(stored().budgetKurus).toBe(100000);

    await addExpense(user, { amount: "0,01", category: "Diğer" });
    expect(read(screen.getByText(/aşıldı/).textContent)).toBe("Bütçe ₺0,01 aşıldı (%101).");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("changes and removes the budget", async () => {
    seed([expense("a", "2026-11-02", "market", 25000)], 100000);
    const { user } = renderApp();
    expect(read(screen.getByText(/kullanıldı\)\.$/).textContent)).toBe("₺750,00 kaldı (%25 kullanıldı).");
    await user.click(screen.getByRole("button", { name: "Bütçeyi değiştir" }));
    const field = screen.getByLabelText("Bütçe (TL)");
    expect(field).toHaveValue("1.000,00");
    await user.clear(field);
    await user.type(field, "abc");
    await user.click(screen.getByRole("button", { name: "Bütçeyi kaydet" }));
    expect(field).toHaveAccessibleDescription("Tutarı 1.250,50 biçiminde yazın.");
    await user.clear(field);
    await user.type(field, "500");
    await user.click(screen.getByRole("button", { name: "Bütçeyi kaydet" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");

    await user.click(screen.getByRole("button", { name: "Bütçeyi kaldır" }));
    expect(screen.getByLabelText("Bütçe (TL)")).toHaveValue("");
    expect(stored().budgetKurus).toBeNull();
  });
});

describe("months, filters and sorting", () => {
  const data = [
    expense("n1", "2026-11-03", "market", 5000, "Ekmek", 1),
    expense("n2", "2026-11-12", "fatura", 9000, "Elektrik", 2),
    expense("o1", "2026-10-20", "kira", 1500000, "Kira", 3),
  ];

  it("shows one month at a time", async () => {
    seed(data);
    const { user } = renderApp();
    expect(card("Toplam harcama")).toBe("Toplam harcama₺140,00Kasım 2026");
    expect(card("Günlük ortalama")).toBe("Günlük ortalama₺8,7516 gün üzerinden");
    await user.selectOptions(screen.getByLabelText("Ay"), "Ekim 2026");
    expect(rowTexts("Ekim 2026")).toEqual([expect.stringContaining("Kira₺15.000,00")]);
    expect(card("Günlük ortalama")).toBe("Günlük ortalama₺483,8731 gün üzerinden");
  });

  it("filters by category and sorts by amount", async () => {
    seed(data);
    const { user } = renderApp();
    expect(rowTexts().map((text) => text.slice(0, 11))).toEqual(["12 Kas 2026", "3 Kas 2026M"]);
    await user.selectOptions(screen.getByLabelText("Sırala"), "Tutar (küçükten büyüğe)");
    expect(rowTexts()[0]).toContain("Ekmek");
    await user.selectOptions(screen.getByLabelText("Kategori", { selector: "#filter-category" }), "Fatura");
    expect(rowTexts()).toEqual([expect.stringContaining("Elektrik")]);
    await user.selectOptions(screen.getByLabelText("Kategori", { selector: "#filter-category" }), "Sağlık");
    expect(screen.getByText("Kasım 2026 içinde bu seçime uyan harcama yok.")).toBeInTheDocument();
  });

  it("lists the categories with one-decimal shares that add up to 100", () => {
    seed(data);
    renderApp();
    const items = within(screen.getByRole("list", { name: "Kasım 2026 kategori dağılımı" })).getAllByRole("listitem");
    expect(items.map((item) => read(item.textContent))).toEqual(["Fatura₺90,00 %64,3", "Market₺50,00 %35,7"]);
  });

  it("shows a tiny share as less than a tenth of a percent instead of zero", () => {
    seed([expense("big", "2026-11-01", "kira", 99_999_900), expense("small", "2026-11-02", "market", 100)]);
    renderApp();
    const items = within(screen.getByRole("list", { name: "Kasım 2026 kategori dağılımı" })).getAllByRole("listitem");
    expect(items.map((item) => read(item.textContent))).toEqual(["Kira ve aidat₺999.999,00 %100,0", "Market₺1,00 <%0,1"]);
  });
});

describe("export, sample data and clearing", () => {
  it("downloads the visible list as a Turkish CSV file", async () => {
    const data = [expense("n1", "2026-11-03", "market", 5000, "Ekmek", 1), expense("n2", "2026-11-12", "fatura", 9000, "Elektrik", 2)];
    seed(data);
    const downloads = captureDownloads();
    const { user } = renderApp();
    await user.selectOptions(screen.getByLabelText("Kategori", { selector: "#filter-category" }), "Market");
    await user.click(screen.getByRole("button", { name: "CSV indir" }));
    expect(downloads.clicks.map((click) => click.download)).toEqual(["harcamalar-2026-11-market.csv"]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(await downloads.files[0].arrayBuffer())).toBe(expensesToCsv([data[0]]));
  });

  it("cannot download an empty list", () => {
    renderApp();
    expect(screen.getByRole("button", { name: "CSV indir" })).toBeDisabled();
  });

  it("fills an empty panel with sample data on request", async () => {
    const { user } = renderApp();
    expect(screen.getByText("Henüz harcama eklemediniz.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Örnek verilerle dene" }));
    expect(rows().length).toBeGreaterThan(5);
    expect(stored().budgetKurus).toBe(SAMPLE_BUDGET_KURUS);
  });

  it("starts with sample data from the shared link only when the panel is empty, and saves nothing until a change", () => {
    renderApp({ startWithSample: true });
    expect(rows().length).toBeGreaterThan(5);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("never replaces real data with sample data", () => {
    seed([expense("mine", "2026-11-01", "market", 100, "Benim", 1)]);
    renderApp({ startWithSample: true });
    expect(rowTexts()).toEqual([expect.stringContaining("Benim")]);
  });

  it("deletes everything only after a confirmation", async () => {
    seed([expense("a", "2026-11-01", "market", 100)], 5000);
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Bütün verileri sil" }));
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(rows()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Bütün verileri sil" }));
    await user.click(screen.getByRole("button", { name: "Evet, hepsini sil" }));
    expect(screen.getByText("Henüz harcama eklemediniz.")).toBeInTheDocument();
    expect(stored()).toEqual({ version: 1, expenses: [], budgetKurus: null });
    expect(screen.getByRole("button", { name: "Bütün verileri sil" })).toBeDisabled();
  });
});

describe("storage problems", () => {
  it("opens with a notice and keeps a backup when saved data is unreadable", async () => {
    localStorage.setItem(STORAGE_KEY, "{bozuk");
    const { user } = renderApp();
    expect(screen.getByRole("alert")).toHaveTextContent("Kayıtlı veriler okunamadı. Eski hâli yedeklendi, sayfa boş açıldı.");
    expect(localStorage.getItem(`${BACKUP_PREFIX}${NOW.toISOString()}`)).toBe("{bozuk");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{bozuk");
    await user.click(screen.getByRole("button", { name: "Kapat" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says so when a change cannot be saved", async () => {
    const full = { getItem: () => null, setItem: () => { throw new Error("full"); }, removeItem: () => {} };
    const { user } = renderApp({ storage: full });
    await addExpense(user, { amount: "5", category: "Market" });
    expect(screen.getByRole("alert")).toHaveTextContent("Değişiklikler kaydedilemedi: tarayıcının depolama alanı dolu ya da kapalı.");
    expect(rowTexts()).toHaveLength(1);
  });

  it("never writes over unreadable data that could not be backed up", async () => {
    const writes = [];
    const full = { getItem: () => "{bozuk", setItem: (key) => { writes.push(key); throw new Error("full"); }, removeItem: () => {} };
    const { user } = renderApp({ storage: full });
    expect(screen.getByRole("alert")).toHaveTextContent("Kayıtlı verilerin yedeği alınamadı; üzerine yazılmasın diye değişiklikler kaydedilmeyecek.");
    await addExpense(user, { amount: "5", category: "Market" });
    expect(rowTexts()).toHaveLength(1);
    expect(writes).toEqual([`${BACKUP_PREFIX}${NOW.toISOString()}`]);
  });

  it("shows what another tab saved and keeps it on the next change", async () => {
    seed([expense("mine", "2026-11-01", "market", 100, "Benim", 1)]);
    const { user } = renderApp();
    seed([expense("mine", "2026-11-01", "market", 100, "Benim", 1), expense("other", "2026-11-02", "ulasim", 200, "Öteki sekme", 2)]);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY })));
    expect(rowTexts()).toEqual([expect.stringContaining("Öteki sekme"), expect.stringContaining("Benim")]);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "baska-bir-uygulama" })));
    expect(rowTexts()).toHaveLength(2);
    await addExpense(user, { amount: "3", category: "Diğer" });
    expect(stored().expenses.map((item) => item.id).sort()).toEqual(["id-1", "mine", "other"].sort());
  });

  it("works without saving when the browser blocks storage", async () => {
    const refuse = () => { throw new Error("blocked"); };
    const { user } = renderApp({ storage: { getItem: refuse, setItem: refuse, removeItem: refuse } });
    expect(screen.getByRole("alert")).toHaveTextContent("Tarayıcı veri saklamaya izin vermiyor; değişiklikler sayfa kapanınca kaybolur.");
    await addExpense(user, { amount: "5", category: "Market" });
    expect(rowTexts()).toHaveLength(1);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Tarayıcı veri saklamaya izin vermiyor; değişiklikler sayfa kapanınca kaybolur.");
  });
});
