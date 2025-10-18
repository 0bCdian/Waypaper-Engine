import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply default theme immediately to prevent flash
const defaultTheme = localStorage.getItem("waypaper-theme") || "gruvbox";
document.documentElement.setAttribute("data-theme", defaultTheme);

const root = document.getElementById("root");
if (root === null) {
	throw new Error("Could not find root div element");
}

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
