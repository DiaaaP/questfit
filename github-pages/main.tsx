import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import "@/frontend/styles/questfit.css";
import { QuestFitApp } from "@/frontend/components/questfit-app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QuestFitApp />
  </StrictMode>,
);
