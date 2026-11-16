import { formatKurus } from "../lib/money.js";
import * as ui from "../ui.js";

/** Four numbers for the month on screen. */
export function SummaryCards({ summary, monthName }) {
  const cards = [
    ["Toplam harcama", formatKurus(summary.total), monthName],
    ["Harcama sayısı", String(summary.count), summary.count ? "kayıt" : "Kayıt yok"],
    ["Günlük ortalama", formatKurus(summary.dailyAverage), `${summary.daysCounted} gün üzerinden`],
    ["En çok harcanan", summary.top ? summary.top.category.label : "Yok", summary.top ? formatKurus(summary.top.total) : "Kayıt yok"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map(([title, value, detail]) => (
        <div key={title} className={`${ui.card} min-w-0 max-sm:p-4`}>
          <dt className={ui.muted}>{title}</dt>
          {/* A very large amount may wrap inside its digits rather than spill out of the card on a phone. */}
          <dd className="tabular mt-1 text-lg font-semibold [overflow-wrap:anywhere] text-slate-900 sm:text-2xl dark:text-slate-50">{value}</dd>
          <dd className={`mt-1 ${ui.muted}`}>{detail}</dd>
        </div>
      ))}
    </dl>
  );
}
