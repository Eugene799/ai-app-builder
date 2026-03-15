import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Toaster } from "@/components/ui/sonner";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element not found");
}

createRoot(container).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" richColors />
  </React.StrictMode>
);
