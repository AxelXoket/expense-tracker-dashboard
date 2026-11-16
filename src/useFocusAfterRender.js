import { useEffect, useRef } from "react";

/**
 * Move focus after the next render to the element with `id`, for when the control that had focus is replaced or
 * removed by a change. When that element is not on screen, the one with `fallbackId` gets focus instead.
 */
export function useFocusAfterRender() {
  const next = useRef(null);
  useEffect(() => {
    if (!next.current) return;
    const { id, fallbackId } = next.current;
    next.current = null;
    (document.getElementById(id) ?? document.getElementById(fallbackId))?.focus();
  });
  return (id, fallbackId) => {
    next.current = { id, fallbackId };
  };
}
