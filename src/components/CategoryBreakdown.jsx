import { formatShare } from "../lib/expenses.js";
import { formatKurus } from "../lib/money.js";
import * as ui from "../ui.js";

/** Where the month's money went, largest category first. Shares have one decimal and add up to exactly 100. */
export function CategoryBreakdown({ rows, monthName }) {
  return (
    <section className={ui.card} aria-labelledby="breakdown-title">
      <h2 id="breakdown-title" className={ui.heading}>Kategori dağılımı</h2>
      {rows.length === 0 ? (
        <p className={`mt-3 ${ui.muted}`}>{monthName} için harcama yok.</p>
      ) : (
        <ul className="mt-4 space-y-3" aria-label={`${monthName} kategori dağılımı`}>
          {rows.map(({ category, total, shareTenths }) => (
            <li key={category.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                  <span className={`size-2.5 shrink-0 rounded-full ${ui.categoryStyle[category.id].bar}`} aria-hidden="true" />
                  {category.label}
                </span>
                <span className="tabular text-slate-700 dark:text-slate-300">
                  {formatKurus(total)}{" "}
                  <span className="inline-block w-14 text-right font-semibold">{formatShare(shareTenths)}</span>
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                <div className={`h-full rounded-full ${ui.categoryStyle[category.id].bar}`} style={{ width: `${shareTenths / 10}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
