import { isCategory } from "./categories.js";
import { isRealDay } from "./dates.js";
import { EARLIEST_DAY, NOTE_MAX_LENGTH, noteLength } from "./expenses.js";
import { MAX_AMOUNT_KURUS } from "./money.js";

export const STORAGE_KEY = "harcama-paneli:v1";
// Each different unreadable text gets its own backup ("harcama-paneli:yedek:<time>"), so a later problem never erases
// an earlier copy.
export const BACKUP_PREFIX = "harcama-paneli:yedek:";

export function emptyData() {
  return { expenses: [], budgetKurus: null };
}

const isWholeKurus = (value) => Number.isInteger(value) && value > 0 && value <= MAX_AMOUNT_KURUS;

function isStoredExpense(item) {
  return (
    typeof item?.id === "string" && item.id !== "" &&
    isWholeKurus(item.amountKurus) &&
    isCategory(item.category) &&
    typeof item.date === "string" && isRealDay(item.date) && item.date >= EARLIEST_DAY &&
    typeof item.note === "string" && noteLength(item.note) <= NOTE_MAX_LENGTH &&
    Number.isFinite(item.createdAt)
  );
}

const BLOCKED = "Tarayıcı veri saklamaya izin vermiyor; değişiklikler sayfa kapanınca kaybolur.";
const NOT_BACKED_UP = "Kayıtlı verilerin yedeği alınamadı; üzerine yazılmasın diye değişiklikler kaydedilmeyecek.";

/**
 * Read the saved data. Never throws. Anything unreadable is first copied to a backup key; when even that copy
 * cannot be written, saving is switched off (`canSave: false`) so the original is never overwritten.
 * Returns { data, notice, canSave }; `notice` is Turkish text for the person, or null.
 */
export function loadData(storage, time = Date.now()) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: emptyData(), notice: BLOCKED, canSave: false };
  }
  if (raw === null) return { data: emptyData(), notice: null, canSave: true };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not JSON at all: the shape check below treats it like any other unreadable value.
  }
  if (parsed?.version !== 1 || !Array.isArray(parsed.expenses)) {
    const backedUp = keepBackup(storage, raw, time);
    return {
      data: emptyData(),
      notice: `Kayıtlı veriler okunamadı. ${backedUp ? "Eski hâli yedeklendi, sayfa boş açıldı." : NOT_BACKED_UP}`,
      canSave: backedUp,
    };
  }

  const ids = new Set();
  const expenses = [];
  for (const item of parsed.expenses) {
    if (!isStoredExpense(item) || ids.has(item.id)) continue;
    ids.add(item.id);
    // Only the known fields go on, so nothing unchecked is carried into the next save.
    const { id, amountKurus, category, date, note, createdAt } = item;
    expenses.push({ id, amountKurus, category, date, note, createdAt });
  }
  const budgetKurus = isWholeKurus(parsed.budgetKurus) ? parsed.budgetKurus : null;
  const skipped = parsed.expenses.length - expenses.length;
  const budgetLost = parsed.budgetKurus != null && budgetKurus === null;
  if (skipped === 0 && !budgetLost) return { data: { expenses, budgetKurus }, notice: null, canSave: true };

  const problems = [];
  if (skipped > 0) problems.push(`${skipped} harcama kaydı okunamadığı için atlandı.`);
  if (budgetLost) problems.push("Kayıtlı bütçe okunamadığı için kaldırıldı.");
  const backedUp = keepBackup(storage, raw, time);
  problems.push(backedUp ? "Eski hâli yedeklendi." : NOT_BACKED_UP);
  return { data: { expenses, budgetKurus }, notice: problems.join(" "), canSave: backedUp };
}

/** Keys of all backup copies. A storage that cannot list its keys has none to offer. */
function backupKeys(storage) {
  return Array.from({ length: storage.length ?? 0 }, (_, index) => storage.key(index))
    .filter((key) => key?.startsWith(BACKUP_PREFIX));
}

function keepBackup(storage, raw, time) {
  try {
    // The same unreadable text is kept once, so opening the page again and again does not fill the storage.
    if (backupKeys(storage).some((key) => storage.getItem(key) === raw)) return true;
    storage.setItem(`${BACKUP_PREFIX}${new Date(time).toISOString()}`, raw);
    return true;
  } catch {
    return false;
  }
}

/** Delete every backup copy, as part of deleting all data. A browser that refuses is left as it is. */
export function removeBackups(storage) {
  try {
    for (const key of backupKeys(storage)) storage.removeItem(key);
  } catch {
    // Blocked storage: there is nothing this page can delete, and saving reports the problem already.
  }
}

/** Save the data; false when the browser refuses (storage full or blocked). */
export function saveData(storage, data) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, expenses: data.expenses, budgetKurus: data.budgetKurus }));
    return true;
  } catch {
    return false;
  }
}
