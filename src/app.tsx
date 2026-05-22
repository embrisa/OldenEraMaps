import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/AppShell";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root missing.");

createRoot(app).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);
