import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./theme.css";

// Service worker : uniquement sur le build de production. En dev, un cache
// de coquille masquerait les modifications a chaque rechargement.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Enregistrement refuse (contexte non securise, navigation privee) :
      // l'appli marche sans, elle perd juste l'ouverture hors ligne.
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
