import { CATEGORIES, categoryById } from "../lib/categories.js";
import { dayLabel, longDayLabel } from "../lib/dates.js";
import { SORTS } from "../lib/expenses.js";
import { formatKurus } from "../lib/money.js";
import * as ui from "../ui.js";

/** The month's expenses with category filter, sort order, and edit and delete buttons. */
export function ExpenseList({ expenses, hasAny, monthName, category, sort, editingId, onCategory, onSort, onEdit, onRemove, onSample }) {
  return (
    <section className={ui.card} aria-labelledby="list-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="list-title" tabIndex={-1} className={ui.heading}>
          Harcamalar <span className="font-normal text-slate-600 dark:text-slate-400">({expenses.length})</span>
        </h2>
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="filter-category" className={ui.label}>Kategori</label>
            <select id="filter-category" className={ui.field} value={category} onChange={(event) => onCategory(event.target.value)}>
              <option value="all">Tümü</option>
              {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sort-order" className={ui.label}>Sırala</label>
            <select id="sort-order" className={ui.field} value={sort} onChange={(event) => onSort(event.target.value)}>
              {Object.entries(SORTS).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!hasAny ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
          <p className="font-medium text-slate-800 dark:text-slate-200">Henüz harcama eklemediniz.</p>
          <p className={`mt-1 ${ui.muted}`}>İlk harcamanızı formdan ekleyin ya da paneli örnek verilerle deneyin.</p>
          <button type="button" className={`mt-4 ${ui.secondaryButton}`} onClick={onSample}>Örnek verilerle dene</button>
        </div>
      ) : expenses.length === 0 ? (
        <p className={`mt-6 ${ui.muted}`}>{monthName} içinde bu seçime uyan harcama yok.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800" aria-label={`${monthName} harcamaları`}>
          {expenses.map((expense) => (
            <ExpenseRow key={expense.id} expense={expense} editing={expense.id === editingId} onEdit={onEdit} onRemove={onRemove} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ExpenseRow({ expense, editing, onEdit, onRemove }) {
  const category = categoryById(expense.category);
  const amount = formatKurus(expense.amountKurus);
  const spoken = `${longDayLabel(expense.date)} tarihli ${amount} tutarındaki ${category.label} harcaması`;
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${editing ? "bg-emerald-50 dark:bg-emerald-950/40" : ""}`}
      aria-current={editing ? "true" : undefined}>
      <span className="tabular w-24 shrink-0 text-sm text-slate-600 dark:text-slate-400">{dayLabel(expense.date)}</span>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ui.categoryStyle[category.id].badge}`}>{category.label}</span>
      <span className="min-w-0 flex-1 basis-40 break-words text-slate-800 dark:text-slate-200">
        {expense.note || <span className="text-slate-500 dark:text-slate-400">Not yok</span>}
      </span>
      <span className="tabular ml-auto font-semibold text-slate-900 dark:text-slate-50">{amount}</span>
      <span className="flex items-center gap-1">
        {editing && <span className="mr-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300">Düzenleniyor</span>}
        <button id={`edit-${expense.id}`} type="button" className={ui.quietButton} onClick={() => onEdit(expense)}
          aria-label={`${spoken}: düzenle`}>Düzenle</button>
        <button type="button" className={ui.quietDangerButton} onClick={() => onRemove(expense)}
          aria-label={`${spoken}: sil`}>Sil</button>
      </span>
    </li>
  );
}
