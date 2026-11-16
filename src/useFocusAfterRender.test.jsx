import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useFocusAfterRender } from "./useFocusAfterRender.js";

// A button that asks for focus to move to `target` (or `fallback`) after the re-render its own click causes.
function Mover({ target, fallback }) {
  const [clicks, setClicks] = useState(0);
  const focusAfterRender = useFocusAfterRender();
  return (
    <>
      <button type="button" onClick={() => { focusAfterRender(target, fallback); setClicks(clicks + 1); }}>Taşı {clicks}</button>
      <input id="hedef" aria-label="Hedef" />
      <input id="yedek" aria-label="Yedek" />
    </>
  );
}

describe("useFocusAfterRender", () => {
  it("moves focus to the element, or to the fallback when the element is not on screen", () => {
    const { rerender } = render(<Mover target="hedef" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByLabelText("Hedef")).toHaveFocus();
    rerender(<Mover target="yok" fallback="yedek" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByLabelText("Yedek")).toHaveFocus();
  });

  it("leaves focus alone, without an error, when neither element is on screen", () => {
    render(<Mover target="yok" fallback="o-da-yok" />);
    const button = screen.getByRole("button");
    button.focus();
    expect(() => fireEvent.click(button)).not.toThrow();
    expect(screen.getByRole("button")).toHaveFocus();
  });
});
