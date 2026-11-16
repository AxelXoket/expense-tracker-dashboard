// @vitest-environment node
import { describe, expect, it } from "vitest";
import { categoryStyle } from "../ui.js";
import { CATEGORIES, categoryById, isCategory } from "./categories.js";

describe("categories", () => {
  it("each have a unique id and a unique, non-empty name", () => {
    const ids = CATEGORIES.map((category) => category.id);
    const labels = CATEGORIES.map((category) => category.label);
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.filter((label) => label.trim() === "")).toEqual([]);
    expect(ids.filter((id) => !/^[a-z]+(-[a-z]+)*$/.test(id))).toEqual([]);
  });

  it("each have a colour, and no colour is left without a category", () => {
    expect(Object.keys(categoryStyle).sort()).toEqual(CATEGORIES.map((category) => category.id).sort());
  });

  it("are found by id", () => {
    expect(categoryById("market").label).toBe("Market");
    expect(isCategory("market")).toBe(true);
    expect(isCategory("kumar")).toBe(false);
    expect(categoryById("kumar")).toBeUndefined();
  });
});
