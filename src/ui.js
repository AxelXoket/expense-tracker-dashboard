// Shared class names, so every card, field and button looks the same.
export const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
export const heading = "text-lg font-semibold text-slate-900 dark:text-slate-50";
export const label = "block text-sm font-medium text-slate-700 dark:text-slate-300";
export const field =
  "mt-1 block w-full rounded-lg border border-slate-500 bg-white px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-500 " +
  "focus:border-emerald-700 focus:outline-2 focus:outline-offset-1 focus:outline-emerald-700 " +
  "aria-[invalid=true]:border-red-600 dark:border-slate-500 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-emerald-400 dark:focus:outline-emerald-400 " +
  "dark:aria-[invalid=true]:border-red-400";
export const fieldError = "mt-1 text-sm text-red-700 dark:text-red-300";
const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";
export const primaryButton =
  `rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-emerald-800 ${focusRing}`;
export const secondaryButton =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 shadow-sm hover:bg-slate-100 " +
  `dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 ${focusRing}`;
const quiet = `rounded-md px-2 py-1 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 ${focusRing}`;
export const quietButton = `${quiet} text-emerald-800 dark:text-emerald-300`;
export const quietDangerButton = `${quiet} text-red-700 dark:text-red-300`;
export const dangerButton =
  "rounded-lg bg-red-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-red-800 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700";
export const muted = "text-sm text-slate-600 dark:text-slate-400";

// Category colours, written out in full so Tailwind can find them in the source.
export const categoryStyle = {
  market: { badge: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100", bar: "bg-emerald-500" },
  "yeme-icme": { badge: "bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100", bar: "bg-orange-500" },
  ulasim: { badge: "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100", bar: "bg-sky-500" },
  fatura: { badge: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100", bar: "bg-amber-500" },
  kira: { badge: "bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100", bar: "bg-violet-500" },
  saglik: { badge: "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100", bar: "bg-rose-500" },
  eglence: { badge: "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/50 dark:text-fuchsia-100", bar: "bg-fuchsia-500" },
  giyim: { badge: "bg-pink-100 text-pink-900 dark:bg-pink-900/50 dark:text-pink-100", bar: "bg-pink-500" },
  egitim: { badge: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100", bar: "bg-indigo-500" },
  diger: { badge: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100", bar: "bg-slate-500" },
};

// Budget bar colour per level, at least 3:1 against the bar track in both themes. The level is also said in words,
// so colour is never the only signal.
export const budgetBar = {
  ok: "bg-emerald-700 dark:bg-emerald-500",
  near: "bg-amber-700 dark:bg-amber-500",
  over: "bg-red-600 dark:bg-red-400",
};
