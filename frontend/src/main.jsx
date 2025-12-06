// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Initialize theme early to avoid flash (reads localStorage before React mounts)
try {
  // default to dark for a consistent, readable UI per design request
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme) document.documentElement.setAttribute('data-theme', theme);
} catch {}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
