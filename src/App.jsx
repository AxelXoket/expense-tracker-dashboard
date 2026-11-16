import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { BudgetCard } from "./components/BudgetCard.jsx";
import { CategoryBreakdown } from "./components/CategoryBreakdown.jsx";
import { ExpenseForm } from "./components/ExpenseForm.jsx";
import { ExpenseList } from "./components/ExpenseList.jsx";
import { SummaryCards } from "./components/SummaryCards.jsx";
import { UndoToast } from "./components/UndoToast.jsx";
import { categoryById } from "./lib/categories.js";
import { isoDay, monthLabel, monthOf } from "./lib/dates.js";
import { availableMonths, expensesToCsv, summarizeMonth, visibleExpenses } from "./lib/expenses.js";
import { formatKurus } from "./lib/money.js";
import { SAMPLE_BUDGET_KURUS, sampleExpenses } from "./lib/sample.js";
import { emptyData, loadData, removeBackups, saveData, STORAGE_KEY } from "./lib/storage.js";
import * as ui from "./ui.js";
import { useFocusAfterRender } from "./useFocusAfterRender.js";

// Safari may still be reading the file after the click; FileSaver.js waits 40 seconds before freeing it for the same
// reason.
export const DOWNLOAD_KEEP_MS = 40_000;
const EDIT_GONE = "Düzenlediğiniz harcama başka bir sekmede silindi.";

/** How a message names an expense: "Market, ₺125,50". */
const describe = (expense) => `${categoryById(expense.category).label}, ${formatKurus(expense.amountKurus)}`;

const CHANGES = {
  add: (data, { expense }) => ({ ...data, expenses: [...data.expenses, expense] }),
  update: (data, { expense }) => ({ ...data, expenses: data.expenses.map((item) => (item.id === expense.id ? expense : item)) }),
  remove: (data, { id }) => ({ ...data, expenses: data.expenses.filter((item) => item.id !== id) }),
  budget: (data, { budgetKurus }) => ({ ...data, budgetKurus }),
  replace: (_, { data }) => data,
};

const reducer = (data, action) => CHANGES[action.type](data, action);

function startingData(storage, startWithSample, today) {
  const loaded = loadData(storage, today.getTime());
  if (!startWithSample || loaded.data.expenses.length > 0) return loaded;
  return { ...loaded, data: { expenses: sampleExpenses(today), budgetKurus: loaded.data.budgetKurus ?? SAMPLE_BUDGET_KURUS } };
}

/**
 * The whole panel. `now` and `makeId` are replaceable so tests can fix the date and the ids.
 * Nothing is written to storage until the person changes something.
 */
export default function App({ storage, startWithSample = false, now = () => new Date(), makeId = () => crypto.randomUUID() }) {
  const [start] = useState(() => startingData(storage, startWithSample, now()));
  const [data, dispatch] = useReducer(reducer, start.data);
  const changed = useRef(false);
  // Off while unreadable data could not be backed up; every load, including one after another tab saved, decides again.
  const canSave = useRef(start.canSave);
  const [notice, setNotice] = useState(start.notice);
  const today = isoDay(now());
  const [month, setMonth] = useState(monthOf(today));
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("date-desc");
  const [editing, setEditing] = useState(null);
  const [formStatus, setFormStatus] = useState("");
  const [removed, setRemoved] = useState(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const focusAfterRender = useFocusAfterRender();
  const closeUndo = useCallback(() => setRemoved(null), []);

  const act = (action) => {
    changed.current = true;
    dispatch(action);
  };

  useEffect(() => {
    if (!changed.current || !canSave.current) return;
    if (!saveData(storage, data)) setNotice("Değişiklikler kaydedilemedi: tarayıcının depolama alanı dolu ya da kapalı.");
  }, [data, storage]);

  // Another tab saved: show its data instead of overwriting it with ours on the next change.
  useEffect(() => {
    function reload(event) {
      if (event.key !== STORAGE_KEY) return;
      const loaded = loadData(storage, now().getTime());
      changed.current = false;
      canSave.current = loaded.canSave;
      dispatch({ type: "replace", data: loaded.data });
      // An edit of an expense that is gone could only be lost, so the form closes and says why.
      const editedGone = editing !== null && !loaded.data.expenses.some((item) => item.id === editing.id);
      if (editedGone) {
        setEditing(null);
        focusAfterRender("expense-amount");
      }
      // The new load replaces any earlier notice, which may describe data that is no longer on screen.
      setNotice([loaded.notice, editedGone && EDIT_GONE].filter(Boolean).join(" ") || null);
    }
    window.addEventListener("storage", reload);
    // Stryker disable next-line all: removing the listener only matters when it is replaced or the panel unmounts.
    return () => window.removeEventListener("storage", reload);
    // `now` and `focusAfterRender` are left out: an older copy of either does the same job, and listing them would
    // subscribe again on every render.
  }, [storage, editing]);

  const summary = summarizeMonth(data.expenses, month, today);
  const list = visibleExpenses(data.expenses, { month, category, sort });
  const monthName = monthLabel(month);

  function submitExpense(values) {
    if (editing) {
      act({ type: "update", expense: { ...editing, ...values } });
      setEditing(null);
      setFormStatus(`Değişiklik kaydedildi: ${describe(values)}.`);
      focusAfterRender(`edit-${editing.id}`, "list-title");
    } else {
      act({ type: "add", expense: { id: makeId(), createdAt: now().getTime(), ...values } });
      setFormStatus(`Harcama eklendi: ${describe(values)}.`);
    }
    setMonth(monthOf(values.date));
  }

  function startEditing(expense) {
    setEditing(expense);
    setFormStatus("");
    focusAfterRender("expense-amount");
  }

  function cancelEditing() {
    focusAfterRender(`edit-${editing.id}`, "list-title");
    setEditing(null);
  }

  function remove(expense) {
    act({ type: "remove", id: expense.id });
    if (editing?.id === expense.id) setEditing(null);
    setRemoved(expense);
    focusAfterRender("undo-button");
  }

  function undoRemove() {
    // Another tab may have brought it back already; the same id twice would make edits and deletions hit both.
    if (!data.expenses.some((item) => item.id === removed.id)) act({ type: "add", expense: removed });
    setRemoved(null);
    focusAfterRender(`edit-${removed.id}`, "list-title");
  }

  function loadSample() {
    act({ type: "replace", data: { expenses: sampleExpenses(now()), budgetKurus: data.budgetKurus ?? SAMPLE_BUDGET_KURUS } });
    setRemoved(null);
    setMonth(monthOf(today));
    focusAfterRender("list-title");
  }

  function startClearing() {
    setConfirmingClear(true);
    focusAfterRender("clear-cancel");
  }

  function cancelClearing() {
    setConfirmingClear(false);
    focusAfterRender("clear-start");
  }

  function clearAll() {
    act({ type: "replace", data: emptyData() });
    removeBackups(storage);
    setEditing(null);
    setRemoved(null);
    setConfirmingClear(false);
    setFormStatus("");
    setMonth(monthOf(today));
    focusAfterRender("expense-amount");
  }

  function closeNotice() {
    setNotice(null);
    focusAfterRender("app-title");
  }

  function downloadCsv() {
    const url = URL.createObjectURL(new Blob([expensesToCsv(list)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `harcamalar-${month}${category === "all" ? "" : `-${category}`}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_KEEP_MS);
  }

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-5">
          <div>
            <h1 id="app-title" tabIndex={-1} className="text-2xl font-bold text-slate-900 dark:text-slate-50">Harcama Takip Paneli</h1>
            <p className={ui.muted}>Harcamalarınızı kaydedin, paranızın nereye gittiğini görün.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="month" className={ui.label}>Ay</label>
              <select id="month" className={ui.field} value={month} onChange={(event) => setMonth(event.target.value)}>
                {availableMonths(data.expenses, today, month).map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
              </select>
            </div>
            <button type="button" className={ui.secondaryButton} onClick={downloadCsv} disabled={list.length === 0}>
              CSV indir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {notice && (
          <div role="alert" className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100">
            <p>{notice}</p>
            <button type="button" className={ui.quietButton} onClick={closeNotice}>Kapat</button>
          </div>
        )}
        <SummaryCards summary={summary} monthName={monthName} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <ExpenseForm editing={editing} today={today} status={formStatus}
              onSubmit={submitExpense} onCancel={cancelEditing} />
            <BudgetCard budgetKurus={data.budgetKurus} spentKurus={summary.total} monthName={monthName}
              onSave={(budgetKurus) => act({ type: "budget", budgetKurus })} />
            <CategoryBreakdown rows={summary.byCategory} monthName={monthName} />
          </div>
          <div className="lg:col-span-2">
            <ExpenseList expenses={list} hasAny={data.expenses.length > 0} monthName={monthName} category={category} sort={sort}
              editingId={editing?.id} onCategory={setCategory} onSort={setSort} onEdit={startEditing} onRemove={remove} onSample={loadSample} />
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className={ui.muted}>Veriler yalnız bu tarayıcıda saklanır, hiçbir sunucuya gönderilmez.</p>
          {confirmingClear ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Bütün harcamalar, bütçe ve yedekler silinecek. Emin misiniz?</p>
              <button id="clear-cancel" type="button" className={ui.secondaryButton} onClick={cancelClearing}>Vazgeç</button>
              <button type="button" className={ui.dangerButton} onClick={clearAll}>Evet, hepsini sil</button>
            </div>
          ) : (
            <button id="clear-start" type="button" className={ui.quietDangerButton} onClick={startClearing} disabled={data.expenses.length === 0 && data.budgetKurus === null}>
              Bütün verileri sil
            </button>
          )}
        </div>
      </footer>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-4">
        {removed && (
          <UndoToast key={removed.id} message={`Harcama silindi: ${describe(removed)}.`} onUndo={undoRemove} onClose={closeUndo} />
        )}
      </div>
    </div>
  );
}
