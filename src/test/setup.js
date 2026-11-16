import { afterEach } from "vitest";

// Library tests run in plain Node (no DOM, much faster to start); only component tests load the DOM helpers.
if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });
}
