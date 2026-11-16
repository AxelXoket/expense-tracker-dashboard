import { useEffect, useState } from "react";

export const UNDO_MS = 6000;

/**
 * The offer to bring a deleted expense back. It closes after UNDO_MS, but the time only runs while neither keyboard
 * focus nor the pointer is on it, so nobody has to race the clock (WCAG 2.2.1).
 */
export function UndoToast({ message, onUndo, onClose }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (focused || hovered) return undefined;
    const timer = setTimeout(onClose, UNDO_MS);
    return () => clearTimeout(timer);
  }, [focused, hovered, onClose]);

  return (
    <div className="pointer-events-auto flex items-center gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <span>{message}</span>
      <button id="undo-button" type="button" onClick={onUndo}
        className="shrink-0 rounded-md px-2 py-1 font-semibold text-emerald-300 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-400 dark:text-emerald-800 dark:focus-visible:outline-emerald-800">
        Geri al
      </button>
    </div>
  );
}
