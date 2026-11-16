import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UNDO_MS, UndoToast } from "./UndoToast.jsx";

describe("UndoToast on its own", () => {
  it("closes after UNDO_MS when neither focus nor the pointer is on it", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<UndoToast message="Harcama silindi: Market, ₺5,00." onUndo={() => {}} onClose={onClose} />);
    act(() => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Harcama silindi: Market, ₺5,00.")).toBeInTheDocument();
  });
});
