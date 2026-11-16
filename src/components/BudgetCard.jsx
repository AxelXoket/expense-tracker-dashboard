import { useRef, useState } from "react";
import { budgetStatus } from "../lib/expenses.js";
import { formatKurus, kurusToInput, parseAmount } from "../lib/money.js";
import * as ui from "../ui.js";
import { useFocusAfterRender } from "../useFocusAfterRender.js";

/** From this share of the budget on, the card warns that the month is close to the limit. */
export const NEAR_BUDGET_PERCENT = 80;

/** One monthly budget, compared with the spending of the month on screen. */
export function BudgetCard({ budgetKurus, spentKurus, monthName, onSave }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const field = useRef(null);
  const focusAfterRender = useFocusAfterRender();

  function startEditing() {
    setAmount(kurusToInput(budgetKurus));
    setError("");
    setEditing(true);
    focusAfterRender("budget-amount");
  }

  function stopEditing() {
    setEditing(false);
    focusAfterRender("budget-edit");
  }

  function remove() {
    setAmount("");
    onSave(null);
    focusAfterRender("budget-amount");
  }

  function save(event) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed.error) {
      setError(parsed.error);
      field.current.focus();
      return;
    }
    onSave(parsed.kurus);
    stopEditing();
  }

  const showForm = editing || budgetKurus === null;
  return (
    <section className={ui.card} aria-labelledby="budget-title">
      <h2 id="budget-title" className={ui.heading}>Aylık bütçe</h2>
      {showForm ? (
        <form className="mt-3 space-y-3" onSubmit={save} noValidate>
          {budgetKurus === null && <p className={ui.muted}>Bir bütçe belirleyin, ayın harcaması ona göre izlensin.</p>}
          <div>
            <label htmlFor="budget-amount" className={ui.label}>Bütçe (TL)</label>
            <input id="budget-amount" ref={field} className={`${ui.field} tabular`} inputMode="decimal" autoComplete="off" placeholder="0,00"
              value={amount} onChange={(event) => setAmount(event.target.value)}
              aria-invalid={error ? true : undefined} aria-describedby={error ? "budget-amount-error" : undefined} />
            {error && <p id="budget-amount-error" className={ui.fieldError}>{error}</p>}
          </div>
          <div className="flex gap-3">
            <button type="submit" className={ui.primaryButton}>Bütçeyi kaydet</button>
            {budgetKurus !== null && <button type="button" className={ui.secondaryButton} onClick={stopEditing}>Vazgeç</button>}
          </div>
        </form>
      ) : (
        <BudgetProgress budgetKurus={budgetKurus} spentKurus={spentKurus} monthName={monthName}
          onEdit={startEditing} onRemove={remove} />
      )}
    </section>
  );
}

function BudgetProgress({ budgetKurus, spentKurus, monthName, onEdit, onRemove }) {
  const status = budgetStatus(spentKurus, budgetKurus);
  // Stryker disable next-line StringLiteral: "ok" only picks the bar colour; the sentence under the bar says the same.
  const level = status.over ? "over" : status.percent >= NEAR_BUDGET_PERCENT ? "near" : "ok";
  return (
    <div className="mt-3 space-y-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="tabular text-xl font-semibold">{formatKurus(spentKurus)}</span>
        <span className={`tabular ${ui.muted}`}>{monthName} harcaması, bütçe {formatKurus(budgetKurus)}</span>
      </p>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar"
        aria-label="Bütçenin kullanılan kısmı" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(status.percent, 100)}
        aria-valuetext={`%${status.percent}`}>
        <div className={`h-full rounded-full ${ui.budgetBar[level]}`} style={{ width: `${Math.min(status.percent, 100)}%` }} />
      </div>
      {level === "over" ? (
        <p className="font-semibold text-red-700 dark:text-red-300">Bütçe {formatKurus(-status.remaining)} aşıldı (%{status.percent}).</p>
      ) : (
        <p className="text-slate-700 dark:text-slate-300">{formatKurus(status.remaining)} kaldı (%{status.percent} kullanıldı).</p>
      )}
      {level === "near" && <p className="font-semibold text-amber-800 dark:text-amber-200">Bütçenin sonuna yaklaştınız.</p>}
      <div className="-mx-2 flex flex-wrap gap-2">
        <button id="budget-edit" type="button" className={ui.quietButton} onClick={onEdit}>Bütçeyi değiştir</button>
        <button type="button" className={ui.quietDangerButton} onClick={onRemove}>Bütçeyi kaldır</button>
      </div>
    </div>
  );
}
