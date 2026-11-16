import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages cannot send headers, so the built page carries its Content Security Policy in a meta tag: only this
// site's own files run, the icon may be a data: URL, and nothing can frame-submit forms or change the base URL.
// The dev server is left out because React's live reload needs an inline script.
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'";
export const securityPolicy = {
  name: "content-security-policy",
  apply: "build",
  transformIndexHtml: (html) =>
    html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`),
};

// GitHub Pages serves the site under /<repository name>/.
export default defineConfig({
  base: "/expense-tracker-dashboard/",
  plugins: [react(), tailwindcss(), securityPolicy],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
  },
});
