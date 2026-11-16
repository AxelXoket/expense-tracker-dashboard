// Stryker ignorer: Tailwind class names in JSX `className` attributes are style, not behaviour. They are checked in the
// screenshots and by the design review; a test that pinned them would only copy the source.
import { declareValuePlugin, PluginKind } from "@stryker-mutator/api/plugin";

export const strykerPlugins = [
  declareValuePlugin(PluginKind.Ignore, "ClassNames", {
    shouldIgnore(path) {
      if (path.isJSXAttribute() && path.node.name.name === "className") {
        return "Tailwind class names are style; checked in screenshots, not by tests.";
      }
      return undefined;
    },
  }),
];
