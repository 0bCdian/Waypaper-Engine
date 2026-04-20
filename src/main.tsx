import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

const defaultTheme = localStorage.getItem("waypaper-theme") || "kolision-raw";
document.documentElement.setAttribute("data-theme", defaultTheme);

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Could not find root div element");
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
