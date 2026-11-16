// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, securityPolicy } from "../vite.config.js";

describe("the built page", () => {
  it("carries the Content Security Policy in its head", () => {
    const html = securityPolicy.transformIndexHtml("<!doctype html><html><head><title>x</title></head><body></body></html>");
    const meta = new RegExp(`<head>\\s*<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`);
    expect(html).toMatch(meta);
    expect(securityPolicy.apply).toBe("build");
  });

  it("lets only the site's own files run, with no inline scripts and no forms sent elsewhere", () => {
    const directives = Object.fromEntries(CONTENT_SECURITY_POLICY.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values];
    }));
    expect(directives["default-src"]).toEqual(["'self'"]);
    expect(directives["script-src"]).toBeUndefined();
    expect(directives["form-action"]).toEqual(["'none'"]);
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe");
  });
});
