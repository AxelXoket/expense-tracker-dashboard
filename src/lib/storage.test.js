// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isoDay } from "./dates.js";
import { EARLIEST_DAY, NOTE_MAX_LENGTH } from "./expenses.js";
import { MAX_AMOUNT_KURUS } from "./money.js";
import { BACKUP_PREFIX, emptyData, loadData, removeBackups, saveData, STORAGE_KEY } from "./storage.js";

const TIME = Date.UTC(2026, 10, 16, 9, 30);
const BACKUP = `${BACKUP_PREFIX}2026-11-16T09:30:00.000Z`;
const good = { id: "a", amountKurus: 2500, category: "market", date: "2026-11-10", note: "Ekmek", createdAt: 1 };
const memory = (entries = {}) => {
  const store = new Map(Object.entries(entries));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    get length() {
      return store.size;
    },
    key: (index) => [...store.keys()][index] ?? null,
    store,
  };
};
const dayBefore = (day) => {
  const [year, month, date] = day.split("-").map(Number);
  return isoDay(new Date(year, month - 1, date - 1));
};
const saved = (payload) => memory({ [STORAGE_KEY]: JSON.stringify(payload) });
// Reads work, but every write fails, as when the browser's storage quota is full.
const fullAfter = (raw) => ({ getItem: () => raw, setItem: () => { throw new Error("full"); } });

describe("loading saved data", () => {
  it("starts empty without a notice on the first visit", () => {
    expect(loadData(memory(), TIME)).toEqual({ data: emptyData(), notice: null, canSave: true });
  });

  it("hands out a fresh empty object each time", () => {
    loadData(memory(), TIME).data.expenses.push("x");
    expect(loadData(memory(), TIME).data).toEqual({ expenses: [], budgetKurus: null });
  });

  it("reads back exactly what was saved", () => {
    const storage = memory();
    expect(saveData(storage, { expenses: [good], budgetKurus: 500000 })).toBe(true);
    expect(loadData(storage, TIME)).toEqual({ data: { expenses: [good], budgetKurus: 500000 }, notice: null, canSave: true });
  });

  it("keeps unreadable data as a backup and opens empty with a notice", () => {
    for (const raw of ["{bozuk", "null", "[]", JSON.stringify({ version: 2, expenses: [] }), JSON.stringify({ version: 1 })]) {
      const storage = memory({ [STORAGE_KEY]: raw });
      expect(loadData(storage, TIME)).toEqual({
        data: emptyData(),
        notice: "Kayıtlı veriler okunamadı. Eski hâli yedeklendi, sayfa boş açıldı.",
        canSave: true,
      });
      expect(storage.store.get(BACKUP)).toBe(raw);
    }
  });

  it("never overwrites an earlier backup", () => {
    const storage = memory({ [STORAGE_KEY]: "{ilk" });
    loadData(storage, TIME);
    storage.setItem(STORAGE_KEY, "{ikinci");
    loadData(storage, TIME + 1000);
    expect(storage.store.get(BACKUP)).toBe("{ilk");
    expect(storage.store.get(`${BACKUP_PREFIX}2026-11-16T09:30:01.000Z`)).toBe("{ikinci");
  });

  it("keeps one backup of the same unreadable text, however often the page is opened", () => {
    const storage = memory({ [STORAGE_KEY]: "{bozuk" });
    loadData(storage, TIME);
    expect(loadData(storage, TIME + 60_000).notice).toBe("Kayıtlı veriler okunamadı. Eski hâli yedeklendi, sayfa boş açıldı.");
    expect([...storage.store.keys()].filter((key) => key.startsWith(BACKUP_PREFIX))).toEqual([BACKUP]);
  });

  it("keeps only the known fields of each record", () => {
    const storage = saved({ version: 1, expenses: [{ ...good, gizli: "fazla alan" }], budgetKurus: null });
    expect(loadData(storage, TIME).data.expenses).toEqual([good]);
  });

  it("drops only the broken records, counts them and backs up the original", () => {
    const broken = [
      { ...good, id: "" },
      { ...good, id: "b", amountKurus: 0 },
      { ...good, id: "c", amountKurus: 12.5 },
      { ...good, id: "d", amountKurus: MAX_AMOUNT_KURUS + 1 },
      { ...good, id: "e", category: "kumar" },
      { ...good, id: "f", date: "2026-02-30" },
      { ...good, id: "g", date: dayBefore(EARLIEST_DAY) },
      { ...good, id: "h", note: 5 },
      { ...good, id: "i", note: "x".repeat(NOTE_MAX_LENGTH + 1) },
      { ...good, id: "k", createdAt: "dün" },
      { ...good },
      null,
    ];
    const edge = { ...good, id: "j", amountKurus: MAX_AMOUNT_KURUS, date: EARLIEST_DAY, note: "😀".repeat(NOTE_MAX_LENGTH) };
    const payload = { version: 1, expenses: [good, ...broken, edge], budgetKurus: 100 };
    const storage = saved(payload);
    expect(loadData(storage, TIME)).toEqual({
      data: { expenses: [good, edge], budgetKurus: 100 },
      notice: `${broken.length} harcama kaydı okunamadığı için atlandı. Eski hâli yedeklendi.`,
      canSave: true,
    });
    expect(storage.store.get(BACKUP)).toBe(JSON.stringify(payload));
  });

  it("says when a broken budget was removed, and treats a missing one as no budget", () => {
    for (const budgetKurus of [-5, "3000", MAX_AMOUNT_KURUS + 1]) {
      expect(loadData(saved({ version: 1, expenses: [good], budgetKurus }), TIME)).toMatchObject({
        data: { expenses: [good], budgetKurus: null },
        notice: "Kayıtlı bütçe okunamadığı için kaldırıldı. Eski hâli yedeklendi.",
      });
    }
    expect(loadData(saved({ version: 1, expenses: [good], budgetKurus: MAX_AMOUNT_KURUS }), TIME).data.budgetKurus).toBe(MAX_AMOUNT_KURUS);
    expect(loadData(saved({ version: 1, expenses: [good] }), TIME)).toMatchObject({ data: { budgetKurus: null }, notice: null });
    expect(loadData(saved({ version: 1, expenses: [], budgetKurus: null }), TIME).notice).toBeNull();
  });

  it("names both problems when records and the budget are broken", () => {
    expect(loadData(saved({ version: 1, expenses: [null], budgetKurus: 0 }), TIME).notice)
      .toBe("1 harcama kaydı okunamadığı için atlandı. Kayıtlı bütçe okunamadığı için kaldırıldı. Eski hâli yedeklendi.");
  });

  it("does not write a backup when everything was readable", () => {
    const storage = saved({ version: 1, expenses: [good], budgetKurus: null });
    loadData(storage, TIME);
    expect([...storage.store.keys()]).toEqual([STORAGE_KEY]);
  });

  it("stops saving when the unreadable original cannot be backed up, so it is never overwritten", () => {
    expect(loadData(fullAfter("{bozuk"), TIME)).toEqual({
      data: emptyData(),
      notice: "Kayıtlı veriler okunamadı. Kayıtlı verilerin yedeği alınamadı; üzerine yazılmasın diye değişiklikler kaydedilmeyecek.",
      canSave: false,
    });
    const partly = JSON.stringify({ version: 1, expenses: [good, { id: "x" }], budgetKurus: null });
    expect(loadData(fullAfter(partly), TIME)).toEqual({
      data: { expenses: [good], budgetKurus: null },
      notice: "1 harcama kaydı okunamadığı için atlandı. Kayıtlı verilerin yedeği alınamadı; üzerine yazılmasın diye değişiklikler kaydedilmeyecek.",
      canSave: false,
    });
  });

  it("keeps working when the browser blocks storage", () => {
    const refuse = () => { throw new Error("blocked"); };
    const blocked = { getItem: refuse, setItem: refuse, removeItem: refuse };
    expect(loadData(blocked, TIME)).toEqual({
      data: emptyData(),
      notice: "Tarayıcı veri saklamaya izin vermiyor; değişiklikler sayfa kapanınca kaybolur.",
      canSave: false,
    });
    expect(saveData(blocked, emptyData())).toBe(false);
  });

  it("rejects records whose id or date has the wrong type without crashing", () => {
    const odd = [{ ...good, id: 5 }, { ...good, id: "x", date: ["2026-11-10"] }, "metin", 7];
    expect(loadData(saved({ version: 1, expenses: [good, ...odd], budgetKurus: null }), TIME)).toMatchObject({
      data: { expenses: [good] },
      notice: "4 harcama kaydı okunamadığı için atlandı. Eski hâli yedeklendi.",
    });
  });

  it("deletes every backup copy and nothing else", () => {
    const storage = memory({ [STORAGE_KEY]: "{}", [BACKUP]: "{eski", [`${BACKUP_PREFIX}ikinci`]: "{daha eski", "baska-uygulama": "1" });
    removeBackups(storage);
    expect([...storage.store.keys()]).toEqual([STORAGE_KEY, "baska-uygulama"]);
    const refuse = () => { throw new Error("blocked"); };
    expect(() => removeBackups({ getItem: refuse, setItem: refuse, removeItem: refuse, key: refuse, length: 1 })).not.toThrow();
  });

  it("keeps reading data saved under the published key names", () => {
    // These names are a promise to people who already have data saved; changing them would lose that data.
    const storage = memory({ "harcama-paneli:v1": JSON.stringify({ version: 1, expenses: [good, null], budgetKurus: null }) });
    expect(loadData(storage, TIME).data.expenses).toEqual([good]);
    expect(storage.store.get("harcama-paneli:yedek:2026-11-16T09:30:00.000Z")).toBeDefined();
    saveData(storage, emptyData());
    expect(JSON.parse(storage.store.get("harcama-paneli:v1"))).toEqual({ version: 1, expenses: [], budgetKurus: null });
  });
});
