import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Some browsers throw on the localStorage property itself when site data is blocked; the app then runs unsaved.
function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    const refuse = () => { throw new Error("storage blocked"); };
    return { getItem: refuse, setItem: refuse, removeItem: refuse };
  }
}

// "?ornek" in the address fills an empty panel with sample expenses, so a shared link shows the app in use.
const startWithSample = new URLSearchParams(window.location.search).has("ornek");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App storage={browserStorage()} startWithSample={startWithSample} />
  </StrictMode>,
);
