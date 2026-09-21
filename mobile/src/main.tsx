import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registerServiceWorker } from "./pwa";
import "./theme.css";

// Service worker : uniquement sur le build de production. En dev, un cache
// de coquille masquerait les modifications a chaque rechargement.
if (import.meta.env.PROD) registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
