import { useRef, useState } from "react";
import { CATEGORIES } from "../lib/categories.js";
import { validateExpense } from "../lib/expenses.js";
import { kurusToInput } from "../lib/money.js";
import * as ui from "../ui.js";

const FIELD_ORDER = ["amount", "category", "date", "note"];

/** The fields for a new expense, dated today, or for the expense being edited. */
function startingForm(editing, today) {
  if (editing) return { amount: kurusToInput(editing.amountKurus), category: editing.category, date: editing.date, note: editing.note };
  return {
    amount: "",
    // Stryker disable next-line StringLiteral: an unknown category shows and is refused exactly like no category.
    category: "",
    date: today,
    note: "",
  };
}

/** Add a new expense, or edit `editing` when it is given. Category and date stay filled after adding, for fast entry. */
export function ExpenseForm({ editing, today, status, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => startingForm(editing, today));
  const [errors, setErrors] = useState({});
  // The form stays mounted when editing starts or ends, so its status line stays the same live region and screen
  // readers announce every message. The fields are reset during render instead, as React advises for a changed prop.
  const editingId = editing?.id ?? null;
  const [formFor, setFormFor] = useState(editingId);
  if (editingId !== formFor) {
    setFormFor(editingId);
    setForm(startingForm(editing, today));
    setErrors({});
  }
  const fields = useRef({});

  // Updates build on the latest state, so two changes in one event never drop a field.
  const change = (name) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  function submit(event) {
    event.preventDefault();
    const result = validateExpense(form, today);
    if (result.errors) {
      setErrors(result.errors);
      fields.current[FIELD_ORDER.find((name) => result.errors[name])].focus();
      return;
    }
    setErrors({});
    onSubmit(result.values);
    // Stryker disable next-line ConditionalExpression: after an edit the form is reset by the closed edit, so this is unseen.
    if (!editing) {
      setForm((current) => ({ ...current, amount: "", note: "" }));
      fields.current.amount.focus();
    }
  }

  const describe = (name) => ({
    id: `expense-${name}`,
    ref: (element) => { fields.current[name] = element; },
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `expense-${name}-error` : undefined,
  });
  const error = (name) => errors[name] && <p id={`expense-${name}-error`} className={ui.fieldError}>{errors[name]}</p>;

  return (
    <section className={ui.card} aria-labelledby="expense-form-title">
      <h2 id="expense-form-title" className={ui.heading}>{editing ? "Harcamayı düzenle" : "Harcama ekle"}</h2>
      <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="expense-amount" className={ui.label}>Tutar (TL)</label>
            <input {...describe("amount")} className={`${ui.field} tabular`} inputMode="decimal" autoComplete="off"
              placeholder="0,00" value={form.amount} onChange={change("amount")} />
            {error("amount")}
          </div>
          <div>
            <label htmlFor="expense-date" className={ui.label}>Tarih</label>
            <input {...describe("date")} className={ui.field} type="date" max={today} value={form.date} onChange={change("date")} />
            {error("date")}
          </div>
        </div>
        <div>
          <label htmlFor="expense-category" className={ui.label}>Kategori</label>
          <select {...describe("category")} className={ui.field} value={form.category} onChange={change("category")}>
            <option value="">Seçin</option>
            {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
          {error("category")}
        </div>
        <div>
          <label htmlFor="expense-note" className={ui.label}>Not <span className="font-normal text-slate-500 dark:text-slate-400">(isteğe bağlı)</span></label>
          <input {...describe("note")} className={ui.field} autoComplete="off"
            placeholder="Örneğin: haftalık market" value={form.note} onChange={change("note")} />
          {error("note")}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={ui.primaryButton}>{editing ? "Kaydet" : "Ekle"}</button>
          {editing && <button type="button" className={ui.secondaryButton} onClick={onCancel}>Vazgeç</button>}
          <p role="status" className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{status}</p>
        </div>
      </form>
    </section>
  );
}
