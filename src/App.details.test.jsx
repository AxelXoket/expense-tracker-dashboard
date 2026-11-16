// Finer points of the panel: moving between edits, timers, budget limits, empty months, other tabs and the download.
import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DOWNLOAD_KEEP_MS } from "./App.jsx";
import { UNDO_MS } from "./components/UndoToast.jsx";
import { NEAR_BUDGET_PERCENT } from "./components/BudgetCard.jsx";
import { NOTE_MAX_LENGTH } from "./lib/expenses.js";
import { formatKurus } from "./lib/money.js";
import { SAMPLE_BUDGET_KURUS, sampleExpenses } from "./lib/sample.js";
import { BACKUP_PREFIX, STORAGE_KEY } from "./lib/storage.js";
import {
  addExpense, captureDownloads, card, expense, expenseFields, NOW, read, renderApp, rowButton, rows, rowTexts, seed, stored,
} from "./test/app.jsx";

const manav = expense("a", "2026-11-10", "market", 12550, "Manav", 1);
const elektrik = expense("b", "2026-11-12", "fatura", 25000, "Elektrik", 2);
const otherTabSaved = () => act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY })));
const budgetLine = () => read(screen.getByText(/harcaması, bütçe/).textContent);
// Reads and writes go to the page's storage, but every backup write fails, as when the quota is nearly full.
const noRoomForBackups = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    if (key.startsWith(BACKUP_PREFIX)) throw new Error("full");
    localStorage.setItem(key, value);
  },
  removeItem: (key) => localStorage.removeItem(key),
};

describe("the expense form", () => {
  it("opens empty, dated today, with no message and no cancel button", () => {
    renderApp();
    const fields = expenseFields();
    expect(screen.getByRole("heading", { name: "Harcama ekle" })).toBeInTheDocument();
    expect(fields.amount).toHaveValue("");
    expect(fields.category).toHaveValue("");
    expect(fields.date).toHaveValue("2026-11-16");
    expect(fields.date).toHaveAttribute("max", "2026-11-16");
    expect(fields.note).toHaveValue("");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: "Vazgeç" })).not.toBeInTheDocument();
  });

  it("fills in the other expense when editing moves from one to another", async () => {
    seed([manav, elektrik]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "düzenle"));
    expect(expenseFields().amount).toHaveValue("125,50");
    await user.click(rowButton("Fatura", "düzenle"));
    const fields = expenseFields();
    expect(fields.amount).toHaveValue("250,00");
    expect(fields.category).toHaveValue("fatura");
    expect(fields.date).toHaveValue("2026-11-12");
    expect(fields.note).toHaveValue("Elektrik");
  });

  it("clears the last message when editing starts", async () => {
    seed([manav]);
    const { user } = renderApp();
    await addExpense(user, { amount: "5", category: "Diğer" });
    expect(screen.getByRole("status")).toHaveTextContent("Harcama eklendi: Diğer, ₺5,00.");
    await user.click(rowButton("Market", "düzenle"));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("marks only the row being edited, and none after cancelling", async () => {
    seed([manav, elektrik]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "düzenle"));
    expect(rows().map((row) => row.getAttribute("aria-current"))).toEqual([null, "true"]);
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(rows().map((row) => row.getAttribute("aria-current"))).toEqual([null, null]);
  });

  it("keeps editing one expense while another one is deleted", async () => {
    seed([manav, elektrik]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "düzenle"));
    await user.click(rowButton("Fatura", "sil"));
    expect(screen.getByRole("heading", { name: "Harcamayı düzenle" })).toBeInTheDocument();
    expect(expenseFields().amount).toHaveValue("125,50");
    expect(rows()[0]).toHaveAttribute("aria-current", "true");
  });

  it("drops the error messages of a half-filled new entry when editing starts", async () => {
    seed([manav]);
    const { user } = renderApp();
    await user.type(expenseFields().amount, "abc");
    await user.click(screen.getByRole("button", { name: "Ekle" }));
    expect(screen.getByText("Bir kategori seçin.")).toBeInTheDocument();
    await user.click(rowButton("Market", "düzenle"));
    expect(expenseFields().amount).toHaveValue("125,50");
    expect(expenseFields().amount).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Bir kategori seçin.")).not.toBeInTheDocument();
  });

  it("changes only the edited expense when there are others", async () => {
    seed([manav, elektrik]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "düzenle"));
    await user.clear(expenseFields().amount);
    await user.type(expenseFields().amount, "130");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(stored().expenses).toEqual([{ ...manav, amountKurus: 13000 }, elektrik]);
  });

  it("removes the error messages once the form is sent correctly", async () => {
    const { user } = renderApp();
    await user.type(expenseFields().amount, "abc");
    await user.click(screen.getByRole("button", { name: "Ekle" }));
    expect(expenseFields().amount).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Bir kategori seçin.")).toBeInTheDocument();

    await user.clear(expenseFields().amount);
    await addExpense(user, { amount: "12", category: "Market" });
    expect(rowTexts()).toHaveLength(1);
    expect(expenseFields().amount).not.toHaveAttribute("aria-invalid");
    expect(expenseFields().amount).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText("Tutarı 1.250,50 biçiminde yazın.")).not.toBeInTheDocument();
    expect(screen.queryByText("Bir kategori seçin.")).not.toBeInTheDocument();
  });

  it("refuses a note over 80 characters, says why, puts the cursor there, and takes 80", async () => {
    const { user } = renderApp();
    const fields = expenseFields();
    await user.type(fields.amount, "5");
    await user.selectOptions(fields.category, "Market");
    await user.click(fields.note);
    await user.paste("a".repeat(NOTE_MAX_LENGTH + 1));
    await user.click(screen.getByRole("button", { name: "Ekle" }));
    expect(fields.note).toHaveFocus();
    expect(fields.note).toHaveAccessibleDescription(`Not en çok ${NOTE_MAX_LENGTH} karakter olabilir.`);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    await user.type(fields.note, "{Backspace}");
    await user.click(screen.getByRole("button", { name: "Ekle" }));
    expect(stored().expenses.map((item) => item.note)).toEqual(["a".repeat(NOTE_MAX_LENGTH)]);
  });

  it("writes 'Not yok' for an expense without a note", () => {
    seed([expense("n", "2026-11-02", "ulasim", 700)]);
    renderApp();
    expect(rowTexts()).toEqual([expect.stringContaining("UlaşımNot yok₺7,00")]);
  });

  it("keeps the page in place when either form is sent", () => {
    renderApp();
    expect(fireEvent.submit(screen.getByRole("button", { name: "Ekle" }).closest("form"))).toBe(false);
    expect(fireEvent.submit(screen.getByRole("button", { name: "Bütçeyi kaydet" }).closest("form"))).toBe(false);
  });
});

describe("undo", () => {
  it("offers undo for the latest deletion only and gives it the full time", () => {
    vi.useFakeTimers();
    seed([manav, elektrik]);
    renderApp();
    fireEvent.click(rowButton("Market", "sil"));
    act(() => vi.advanceTimersByTime(UNDO_MS - 1000));
    fireEvent.click(rowButton("Fatura", "sil"));
    act(() => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(screen.getAllByRole("button", { name: "Geri al" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Geri al" }));
    expect(rowTexts()).toEqual([expect.stringContaining("Elektrik")]);
    expect(stored().expenses.map((item) => item.id)).toEqual(["b"]);
  });
});

describe("budget", () => {
  it("starts with the sample budget from the shared link, unless a budget is already saved", () => {
    const first = renderApp({ startWithSample: true });
    expect(budgetLine()).toBe(`Kasım 2026 harcaması, bütçe ${read(formatKurus(SAMPLE_BUDGET_KURUS))}`);
    first.unmount();

    seed([], 50000);
    renderApp({ startWithSample: true });
    expect(budgetLine()).toBe("Kasım 2026 harcaması, bütçe ₺500,00");
  });

  it("shows the hint only while no budget is set and fills in the current one for a change", async () => {
    const hint = "Bir bütçe belirleyin, ayın harcaması ona göre izlensin.";
    const { user } = renderApp();
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(screen.getByLabelText("Bütçe (TL)")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Bütçe (TL)")).not.toHaveAccessibleDescription();
    await user.type(screen.getByLabelText("Bütçe (TL)"), "1.000");
    await user.click(screen.getByRole("button", { name: "Bütçeyi kaydet" }));

    await user.click(screen.getByRole("button", { name: "Bütçeyi değiştir" }));
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Bütçe (TL)")).toHaveValue("1.000,00");
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(budgetLine()).toBe("Kasım 2026 harcaması, bütçe ₺1.000,00");
  });

  it("forgets a wrong entry when the change is cancelled", async () => {
    seed([], 100000);
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Bütçeyi değiştir" }));
    await user.clear(screen.getByLabelText("Bütçe (TL)"));
    await user.type(screen.getByLabelText("Bütçe (TL)"), "abc");
    await user.click(screen.getByRole("button", { name: "Bütçeyi kaydet" }));
    expect(screen.getByLabelText("Bütçe (TL)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Bütçe (TL)")).toHaveAccessibleDescription("Tutarı 1.250,50 biçiminde yazın.");
    expect(stored().budgetKurus).toBe(100000);

    await user.click(screen.getByRole("button", { name: "Vazgeç" }));
    await user.click(screen.getByRole("button", { name: "Bütçeyi değiştir" }));
    expect(screen.getByLabelText("Bütçe (TL)")).toHaveValue("1.000,00");
    expect(screen.getByLabelText("Bütçe (TL)")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Tutarı 1.250,50 biçiminde yazın.")).not.toBeInTheDocument();
  });

  it.each([
    [72000, "72", "%72", "72%"],
    [150000, "100", "%150", "100%"],
  ])("describes %i kuruş of a ₺1.000 budget to screen readers and never draws the bar past full", (spent, now, text, width) => {
    seed([expense("x", "2026-11-05", "market", spent)], 100000);
    renderApp();
    const bar = screen.getByRole("progressbar", { name: "Bütçenin kullanılan kısmı" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", now);
    expect(bar).toHaveAttribute("aria-valuetext", text);
    expect(bar.firstChild.style.width).toBe(width);
  });

  it.each([
    [NEAR_BUDGET_PERCENT * 1000 - 1, false],
    [NEAR_BUDGET_PERCENT * 1000, true],
  ])("warns that the budget is nearly used up only from the limit on (%i kuruş of 100.000)", (spent, warns) => {
    seed([expense("x", "2026-11-05", "market", spent)], 100000);
    renderApp();
    expect(screen.queryByText("Bütçenin sonuna yaklaştınız.") !== null).toBe(warns);
  });
});

describe("summary and breakdown", () => {
  it("says in words that the month has no expenses yet", async () => {
    const { user } = renderApp();
    expect(card("Harcama sayısı")).toBe("Harcama sayısı0Kayıt yok");
    expect(card("En çok harcanan")).toBe("En çok harcananYokKayıt yok");
    expect(card("Günlük ortalama")).toBe("Günlük ortalama₺0,0016 gün üzerinden");
    expect(screen.getByText("Kasım 2026 için harcama yok.")).toBeInTheDocument();

    await addExpense(user, { amount: "5", category: "Market" });
    expect(card("Harcama sayısı")).toBe("Harcama sayısı1kayıt");
  });

  it("draws each category bar as long as its share", () => {
    seed([expense("f", "2026-11-03", "fatura", 9000), expense("m", "2026-11-04", "market", 5000)]);
    renderApp();
    const items = within(screen.getByRole("list", { name: "Kasım 2026 kategori dağılımı" })).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector("[style]").style.width)).toEqual(["64.3%", "35.7%"]);
  });
});

describe("months", () => {
  it("keeps a month in the menu while it is on screen, even after its last expense is deleted", async () => {
    seed([expense("eski", "2026-10-20", "market", 5000, "Ekim alışverişi")]);
    const { user } = renderApp();
    await user.selectOptions(screen.getByLabelText("Ay"), "Ekim 2026");
    await user.click(rowButton("Market", "sil"));
    expect(screen.getByLabelText("Ay")).toHaveValue("2026-10");
    expect(card("Toplam harcama")).toBe("Toplam harcama₺0,00Ekim 2026");

    await user.click(screen.getByRole("button", { name: "Geri al" }));
    expect(rowTexts("Ekim 2026")).toEqual([expect.stringContaining("Ekim alışverişi")]);
  });

  it("drops the undo offer when the sample is loaded, so an old expense cannot come back twice", async () => {
    seed([sampleExpenses(NOW)[0]]);
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: /harcaması: sil$/ }));
    await user.click(screen.getByRole("button", { name: "Örnek verilerle dene" }));
    expect(screen.queryByRole("button", { name: "Geri al" })).not.toBeInTheDocument();
  });

  it("shows the current month after the sample is loaded", async () => {
    seed([expense("eski", "2026-10-20", "market", 5000)]);
    const { user } = renderApp();
    await user.selectOptions(screen.getByLabelText("Ay"), "Ekim 2026");
    await user.click(rowButton("Market", "sil"));
    await user.click(screen.getByRole("button", { name: "Örnek verilerle dene" }));
    expect(screen.getByLabelText("Ay")).toHaveValue("2026-11");
    expect(rows("Kasım 2026").length).toBeGreaterThan(5);
  });
});

describe("other tabs", () => {
  it("ignores storage changes made by other pages", () => {
    seed([manav]);
    renderApp();
    seed([elektrik]);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "baska-bir-uygulama" })));
    expect(rowTexts()).toEqual([expect.stringContaining("Manav")]);
  });

  it("does not write back what another tab has just saved", async () => {
    const { user } = renderApp();
    await addExpense(user, { amount: "5", category: "Market" });
    seed([elektrik]);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    otherTabSaved();
    expect(rowTexts()).toEqual([expect.stringContaining("Elektrik")]);
    expect(writes).not.toHaveBeenCalled();
  });

  it("says so when another tab leaves data that cannot be read, and clears that once a good save follows", () => {
    seed([manav]);
    renderApp();
    localStorage.setItem(STORAGE_KEY, "{bozuk");
    otherTabSaved();
    expect(screen.getByRole("alert")).toHaveTextContent("Kayıtlı veriler okunamadı.");
    expect(screen.getByText("Henüz harcama eklemediniz.")).toBeInTheDocument();

    seed([elektrik]);
    otherTabSaved();
    expect(rowTexts()).toEqual([expect.stringContaining("Elektrik")]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stops saving when another tab leaves data that cannot be backed up", async () => {
    seed([manav]);
    const { user } = renderApp({ storage: noRoomForBackups });
    const newer = JSON.stringify({ version: 2, items: [] });
    localStorage.setItem(STORAGE_KEY, newer);
    otherTabSaved();
    expect(screen.getByRole("alert")).toHaveTextContent("üzerine yazılmasın diye değişiklikler kaydedilmeyecek.");
    await addExpense(user, { amount: "5", category: "Market" });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(newer);
  });

  it("saves again once another tab has replaced unreadable data that could not be backed up", async () => {
    localStorage.setItem(STORAGE_KEY, "{bozuk");
    const { user } = renderApp({ storage: noRoomForBackups });
    seed([elektrik]);
    otherTabSaved();
    await addExpense(user, { amount: "5", category: "Market" });
    expect(stored().expenses.map((item) => item.id)).toEqual(["b", "id-1"]);
  });

  it("closes the edit form and says why when another tab deletes the expense being edited", async () => {
    seed([manav, elektrik]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "düzenle"));
    // Focus on "Vazgeç", which only the edit form has, so focus would be lost if nothing moved it.
    screen.getByRole("button", { name: "Vazgeç" }).focus();
    seed([elektrik]);
    otherTabSaved();
    expect(screen.getByRole("heading", { name: "Harcama ekle" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Düzenlediğiniz harcama başka bir sekmede silindi.");
    expect(expenseFields().amount).toHaveFocus();
  });

  it("puts both notices in one readable line when another tab leaves broken data during an edit", async () => {
    seed([manav]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "düzenle"));
    localStorage.setItem(STORAGE_KEY, "{bozuk");
    otherTabSaved();
    expect(screen.getByRole("alert").firstChild).toHaveTextContent(
      /^Kayıtlı veriler okunamadı\. Eski hâli yedeklendi, sayfa boş açıldı\. Düzenlediğiniz harcama başka bir sekmede silindi\.$/,
    );
  });

  it("keeps the edit open when another tab saves something else", async () => {
    seed([manav]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "düzenle"));
    seed([manav, elektrik]);
    otherTabSaved();
    expect(screen.getByRole("heading", { name: "Harcamayı düzenle" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never brings an expense back twice when another tab has restored it already", async () => {
    seed([manav, elektrik]);
    const { user } = renderApp();
    await user.click(rowButton("Market", "sil"));
    seed([manav, elektrik]);
    otherTabSaved();
    await user.click(screen.getByRole("button", { name: "Geri al" }));
    expect(stored().expenses.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("clearing everything", () => {
  it("closes the edit form and the undo offer and returns to the current month", async () => {
    seed([expense("e1", "2026-10-20", "market", 5000, "Bir"), expense("e2", "2026-10-21", "ulasim", 700, "İki")]);
    const { user } = renderApp();
    await user.selectOptions(screen.getByLabelText("Ay"), "Ekim 2026");
    await user.click(rowButton("Market", "düzenle"));
    await user.click(rowButton("Ulaşım", "sil"));
    await user.click(screen.getByRole("button", { name: "Bütün verileri sil" }));
    await user.click(screen.getByRole("button", { name: "Evet, hepsini sil" }));
    expect(screen.getByLabelText("Ay")).toHaveValue("2026-11");
    expect(screen.getByRole("heading", { name: "Harcama ekle" })).toBeInTheDocument();
    expect(screen.queryByText("Harcama silindi.")).not.toBeInTheDocument();
    expect(stored()).toMatchObject({ expenses: [], budgetKurus: null });
  });

  it("also deletes the backup copies, which may hold old notes", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, expenses: [manav, null], budgetKurus: null }));
    const { user } = renderApp();
    expect(Object.keys(localStorage).filter((key) => key.startsWith(BACKUP_PREFIX))).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Bütün verileri sil" }));
    expect(screen.getByText("Bütün harcamalar, bütçe ve yedekler silinecek. Emin misiniz?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Evet, hepsini sil" }));
    expect(Object.keys(localStorage)).toEqual([STORAGE_KEY]);
  });

  it("also clears the last form message", async () => {
    const { user } = renderApp();
    await addExpense(user, { amount: "5", category: "Market" });
    await user.click(screen.getByRole("button", { name: "Bütün verileri sil" }));
    await user.click(screen.getByRole("button", { name: "Evet, hepsini sil" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it.each([
    ["nothing is saved", [], null, true],
    ["only a budget is saved", [], 100000, false],
    ["only expenses are saved", [manav], null, false],
  ])("is offered only when there is something to delete: %s", (_, expenses, budgetKurus, disabled) => {
    seed(expenses, budgetKurus);
    renderApp();
    expect(screen.getByRole("button", { name: "Bütün verileri sil" }).disabled).toBe(disabled);
  });
});

describe("CSV download", () => {
  it("hands the browser one CSV file through a short-lived link, then frees the file after a while", () => {
    vi.useFakeTimers();
    seed([manav]);
    const downloads = captureDownloads();
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "CSV indir" }));
    expect(downloads.files.map((file) => file.type)).toEqual(["text/csv;charset=utf-8"]);
    expect(downloads.clicks).toEqual([{ download: "harcamalar-2026-11.csv", href: "blob:dosya-1", connected: true }]);
    expect(document.querySelector("a[download]")).toBeNull();
    act(() => vi.advanceTimersByTime(DOWNLOAD_KEEP_MS - 1));
    expect(downloads.revoked).toEqual([]);
    act(() => vi.advanceTimersByTime(1));
    expect(downloads.revoked).toEqual(["blob:dosya-1"]);
  });
});

describe("without a test clock", () => {
  it("dates a new expense by the computer's clock and gives it a random id", async () => {
    const clock = new Date(2027, 1, 3, 9, 30);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(clock);
    const { user } = renderApp({ now: undefined, makeId: undefined });
    await addExpense(user, { amount: "5", category: "Market" });
    const [saved] = stored().expenses;
    expect(saved.date).toBe("2027-02-03");
    expect(saved.createdAt).toBe(clock.getTime());
    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
